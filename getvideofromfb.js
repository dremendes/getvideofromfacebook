// 
// Programa para obter arquivo de vídeo a partir 
// da URL de página de vídeo do Facebook ou do Twitter
// 
// Utilização:
// $ node getvideofromfb.js <link-do-video-no-facebook>
// 
// License
// Licensed under the GNU General Public License (GPL) v3. For more information see [LICENSE]
const puppeteer = require('puppeteer')
const { URL } = require('url')
const fs = require('fs')
const request = require('request');

(async () => {
    const spitLinkErrorAndExit = async (defaultMessage = true) => { 
        if(defaultMessage){
            console.log('Não consegui encontrar o vídeo, o link está correto?')
        }
        await browser.close()
        process.exit(-1)
    }

    if(process.argv.length <= 2){
        console.log("Insira o link da página do vídeo como argumento")
        process.exit(-1)
    }

    const browser = await puppeteer.launch()

    // Valida a URL de argumento
    try {
        new URL(process.argv[2])
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

    const isFromTwitter = (url) => {
        return ["www.twitter.com",
            "twitter.com",
            "mobile.twitter.com",
            "m.twitter.com"
            ].includes(url)
    }

    const downloadVideo = async (url, outputName) => {
        return await request
            .get(url, {timeout: 90000000})
            .on('error', function(err) {
                console.log("Erro ao baixar vídeo :(")
                spitLinkErrorAndExit(false) //Não exibe mensagem padrão
            })
            .pipe(fs.createWriteStream(outputName));
    }

    const link = new URL(process.argv[2])

    // Exit se o link não for do facebook nem do twitter
    if (!(isFromFb(link.host) || isFromTwitter(link.host))) {
        spitLinkErrorAndExit()
    }

    const page = await browser.newPage()

    // Seguir roteiro do twitter ou do facebook?
    if( isFromTwitter(link.host) ) {
        // Primeiro visita a versão desktop 
        // para obter o título. Isso pois na
        // versão mobile ele é suprimido
        const fixedLink = new URL("http://www.twitter.com" + 
                                link.href.substring(link.origin.length, link.href.length) +
                                ((link.href[link.href.length - 1] != '/') ? '/' : '') )

        await page.goto(fixedLink.href, {waitUntil: 'networkidle', networkIdleTimeout: 5000})
        const outputFileName = await page.evaluate(() => {
            return document.title.split(' ').join('-').split('/').join('') + '.mp4'
        })
        // Visita a versão mobile do vídeo da página
        await page.goto("http://mobile.twitter.com" + 
                         fixedLink.href.substring(fixedLink.origin.length, fixedLink.href.length) + "video/1",
                        {waitUntil: 'networkidle', networkIdleTimeout: 5000})
        // Pega o link do video
        const videoLink = await page.evaluate(() => {
            try{
                return document.getElementsByTagName('source')[0].src
            } catch (err) {
                console.log('Talvez algo tenha mudado no twitter? Não consegui achar o vídeo :(')
                return false
            }
        })
        if (!videoLink){ spitLinkErrorAndExit(false) }
        // Baixa e salva no disco
        await downloadVideo(videoLink, outputFileName)

        console.log('Video baixado em ' + outputFileName)
    } else {
        // Primeiro visita a versão desktop 
        // para obter o título. Isso pois na
        // versão mobile ele é suprimido
        await page.goto("http://www.facebook.com" + 
                         link.href.substring(link.origin.length, link.href.length),
                        {waitUntil: 'networkidle', networkIdleTimeout: 5000})
        const outputFileName = await page.evaluate(() => {
            return document.title.split(' ').join('-') + '.mp4'
        })
        // Visita a versão mobile da página
        await page.goto("http://m.facebook.com" + 
                         link.href.substring(link.origin.length, link.href.length),
                        {waitUntil: 'networkidle', networkIdleTimeout: 5000})
        // Dá play no vídeo
        await page.click('#u_0_0 > div > div > div > div > div > i')
                  .catch((error) => {
                    console.log('Erro ao clicar, será que a estrutura mudou?')
                    spitLinkErrorAndExit(false)
                  })
        await page.waitForSelector('#mInlineVideoPlayer', {visible: true})
        // Pega o link do video da página
        const videoLink = await page.evaluate(() => {
            try{
                return document.getElementById('mInlineVideoPlayer').src
            } catch (err) {
                console.log('Será que a estrutura mudou? Não consegui encontrar o vídeo :(')
                return false
            }
        })
        if (!videoLink){ spitLinkErrorAndExit(false) }
        // Baixa e salva no disco
        await downloadVideo(videoLink, outputFileName)

        console.log('Video baixado em ' + outputFileName)
    }

    browser.close()
})();