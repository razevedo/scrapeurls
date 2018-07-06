//clear(); urls = $$('a'); for(url in urls) console.log( urls[url].href )
// document.querySelectorAll('a'); for(url in a) console.log( a[url].href )

const CDP = require('chrome-remote-interface');
const chromeLauncher = require('chrome-launcher');
const request = require('request');
const validUrl = require('valid-url');
const cheerio = require('cheerio');
const fs = require('fs');


function launchChrome(headless=true) {
  return chromeLauncher.launch({
    chromeFlags: [
      '--window-size=412,732',
      '--disable-gpu',
      headless ? '--headless' : ''
    ]
  });
}

async function verifyPageUrls(link) {
  request(link, { json: true }, (err, res, body) => {
    if (err) { 
      fs.appendFile('badUrls.csv', link + "   -   " + err + "\n", (err)=> {  
        if (err) throw err;
          console.log('badUrls.csv file updated');
      });
    }
    try {
      const $ = cheerio.load(body);
      const csvLine = link + "," + $("title").text() + '\n';
      fs.appendFile('goodUrls.csv', csvLine, (err)=> {  
        if (err) throw err;
          console.log('goodUrls.csv file updated');
      });
    } catch(error) {
      fs.appendFile('badUrls.csv', 'problems with Cheerio: URL = ' + link + ', Error = ' + error + "\n", (err)=> {  
        if (err) throw err;
          console.log('badUrls.csv file updated');
      });
    }
  });
}

function initialCleanup() {
  fs.unlink('goodUrls.csv', (err) => {
    if (!err)
    console.log('successfully deleted goodUrls.csv');
  });
  
  fs.unlink('badUrls.csv', (err) => {
    if (!err)
    console.log('successfully deleted goodUrls.csv');
  });
}

(async function() {

  if (process.argv.length < 3) {
    console.log('You need to include the URL as an argument.');
    return;
  };
  console.log("Processing - ", process.argv[2]);
  
  initialCleanup();

  const chrome = await launchChrome();
  const protocol = await CDP({port: chrome.port});

  const {Page, Runtime} = protocol;
  await Promise.all([Page.enable(), Runtime.enable()]);

  Page.navigate({url: process.argv[2]});

  Page.loadEventFired(async () => {

    const code = "(function() { \
          var links = []; listURLs = document.querySelectorAll('a');\
          for (let url of listURLs) \
          { links.push(url.href);  \ }    \
          return JSON.stringify({'links': links}) }())";

    const resultAll = await Runtime.evaluate({expression: code});

    var links = JSON.parse(resultAll.result.value);

    for (var it in links.links) {
      if(validUrl.isUri(links.links[it])) {
        verifyPageUrls(links.links[it]);
      }
    }

    protocol.close();
    chrome.kill(); // Kill Chrome.
  });

})();

