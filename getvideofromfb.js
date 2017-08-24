// 
// Programa para obter arquivo de vídeo a partir 
// da URL de página de vídeo do Facebook
// 
// Utilização:
// $ node getvideofromfb.js <link-do-video-no-facebook>
// 
// License
// Licensed under the GNU General Public License (GPL) v3. For more information see [LICENSE]

const puppeteer = require('puppeteer');
const { URL } = require('url');
const fs = require('fs');
const request = require('request');

(async () => {
    const spitLinkErrorAndExit = (defaultMessage = true) => { 
        if(defaultMessage){
            console.log('Não consegui encontrar o vídeo, o link está correto?'); 
        }
        browser.close(); 
        process.exit(-1);
    }

    if(process.argv.length <= 2){
        console.log("Insira o link da página do vídeo como argumento");
        process.exit(-1);
    }

    const browser = await puppeteer.launch();

    // Valida a URL de argumento
    try {
        new URL(process.argv[2]);
    } catch (err) {
        spitLinkErrorAndExit()
    }

    const isFromFb = (url) => {
        return ["www.facebook.com",
            "facebook.com",
            "www.fb.com",
            "fb.com",
            "m.facebook.com",
            "mobile.facebook.com"
           ].includes(url)
    }

    const link = new URL(process.argv[2]);

    if (!isFromFb(link.host)) {
        spitLinkErrorAndExit();
    }

    const page = await browser.newPage();
    
    // Primeiro visita a versão desktop 
    // para obter o título. Isso pois na
    // versão mobile ele é suprimido
    await page.goto("http://www.facebook.com" + 
                     link.href.substring(link.origin.length, link.href.length),
                    {waitUntil: 'networkidle'})

    const outputFileName = await page.evaluate(() => {
        return document.title.split(' ').join('-') + '.mp4';
    });

    // Visita a versão mobile da página
    await page.goto("http://m.facebook.com" + 
                     link.href.substring(link.origin.length, link.href.length),
                    {waitUntil: 'networkidle'})

    // Dá play no vídeo
    await page.click('#u_0_0 > div > div > div > div > div > i')
              .catch((error) => {
                spitLinkErrorAndExit()
              });
    await page.waitForSelector('#mInlineVideoPlayer', {visible: true});

    // Pega o link do video da página
    const videoLink = await page.evaluate(() => {
        return document.getElementById('mInlineVideoPlayer').src;
    });

    request
        .get(videoLink, {timeout: 90000000})
        .on('error', function(err) {
            console.log("Erro ao baixar vídeo :(");
            spitLinkErrorAndExit(false) //Não exibe mensagem padrão

        })
        .pipe(fs.createWriteStream(outputFileName));

    console.log('Video baixado em ' + outputFileName)
        
    browser.close();
})();