const Apify = require('apify');
const SafeEval = require('safe-eval');
const Cheerio = require('cheerio');

const inputSchema = require('./INPUT_SCHEMA.json')

const path = __dirname;

Apify.main(async () => {

    //const input = await Apify.getInput();
    const input = inputSchema;
    console.log(input);

    if (!input || !input.startUrls) throw new Error('Input must be a JSON object with the "sources" field!');

    const log = Apify.utils.log;
    if (input.debugLog) {
        log.setLevel(log.LEVELS.DEBUG);
    }

    const requestList = await Apify.openRequestList(null, input.startUrls);
    const requestQueue = await Apify.openRequestQueue();

    async function enqueueRequest(request) {
        return requestQueue.addRequest(request)
    }

    var proxyOptions = {}
    if (input.proxyConfiguration.useApifyProxy) {
        proxyOptions.groups = ['AUTO'];
    } else {
        proxyOptions.proxyUrls = input.proxyConfiguration.proxyUrls;
    }
    const proxyConfiguration = await Apify.createProxyConfiguration(proxyOptions);

    // const handlePageFunction = SafeEval(input.pageFunction, { request, Axios, Apify, log });
    const handlePageFunction = async ({ request, response, page }) => {
        const pageFunction = SafeEval(input.pageFunction, {request, response, page, Cheerio, Apify, log});
        let results;
        try {
            results = await pageFunction({request, response, page, enqueueRequest, Cheerio, Apify, log});
        } catch(err) {
            throw new Error(`Error: ${err}`)
        }
        // await prepareRequest({ request, Axios, Apify, log });
        log.debug(`Results type ${typeof results}`);
        //log.debug(`Results from func: ${JSON.stringify(results)}`);

        if (results == "" || results == null) {
            results == undefined;
        }

        if (results && results.length > 0) { //array so it's a crawler
            log.debug(`Found ${results.length} items in to save. Pushing to default dataset`);
            await Apify.pushData(results);
        } else if (results) //object so its an updater
        {
            // log.debug(`Saving single object ${JSON.stringify(results,null,2)}`);
            await Apify.pushData(results);
        }
        else {
            log.info(`No results to save from request ${request.url}`);
        }

    }

    const evalPreFunctions = SafeEval(input.preNavigationHooks);

    const preNavigationHooks = [];
    preNavigationHooks.push(async ( crawlingContext, gotoOptions ) => {
        const { request, page, session } = crawlingContext;
                
        if (input.browserLog) page.on('console', (consoleObj) => console.log(consoleObj.text()));

        gotoOptions.timeout = (input.pageLoadTimeoutSecs) * 1000;
        gotoOptions.waitUntil = input.waitUntil;
    });
    preNavigationHooks.push(...evalPreFunctions);

    const args = [
    '--disable-features=IsolateOrigins,site-per-process',
    '--allow-running-insecure-content',
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--mute-audio',
    '--no-zygote',
    '--no-xshm',
    '--window-size=1920,1080',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--enable-webgl',
    '--ignore-certificate-errors',
    '--lang=en-US,en;q=0.9',
    '--password-store=basic',
    '--disable-gpu-sandbox',
    '--disable-software-rasterizer',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-infobars',
    '--disable-breakpad',
    '--disable-canvas-aa',
    '--disable-2d-canvas-clip-aa',
    '--disable-gl-drawing-for-tests',
    '--enable-low-end-device-mode',
    '--disable-extensions'];
    if (input.ignoreCorsAndCsp) args.push('--disable-web-security');

    const crawler = new Apify.PuppeteerCrawler({
        requestList,
        requestQueue,
        proxyConfiguration,
        launchContext: {
            launchOptions: {
                headless: input.headless,
                ignoreHTTPSErrors: input.ignoreSslErrors,
                defaultViewport: {
                    width: 1920,
                    height: 1080
                },
                args,
                ignoreDefaultArgs: [
                    "--disable-extensions",
                    "--enable-automation"
                ],
            },
            userAgent: input.userAgent ? input.userAgent : undefined,
            useChrome: input.useChrome,
            stealth: input.useStealth,
        },
        preNavigationHooks,
        handlePageFunction,
        maxRequestRetries: input.maxRequestRetries,
        maxConcurrency: input.maxConcurrency,
        handlePageTimeoutSecs: input.pageFunctionTimeoutSecs,
        navigationTimeoutSecs: input.pageLoadTimeoutSecs
    });

    log.info('Starting the crawl.');
    await crawler.run();
    log.info('Crawl finished.');
});
