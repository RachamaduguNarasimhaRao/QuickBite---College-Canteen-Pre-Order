const puppeteer = require('puppeteer');
(async ()=>{
  try{
    const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
    const page = await browser.newPage(); // switched to CommonJS by renaming to .cjs manually
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', e => console.log('PAGE ERROR', e));
    await page.goto('http://localhost:5173/', {waitUntil:'networkidle2'});
    const html = await page.content();
    console.log('HTML length', html.length);
    console.log(html.slice(0,500));
    await browser.close();
  } catch(e){
    console.error('puppeteer error', e);
  }
})();