const axios = require('axios');
const {login, cookie, userAgent} = require('config');
const crypto = require('crypto');
const fs = require('fs');
const moment = require('moment');
const TurndownService = require('turndown');

const tomd = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
tomd.keep(['pre']);

function md5(data) {
    return crypto.createHash('md5').update(data).digest("hex");
}

const headerRegExp = /<h2 class="post__title">.*?href="([^">]*\/([^">]*?))\/(\d+)\/".*?>(.*?)<\/a>.*?<\/h2>/g;
const dateRegExp = /<span class="post__time">(.*?)<\/span>/g;

const contentRegExp = /<textarea.*?>(.*?)<\/textarea>/gs;

const postsPage = `https://habr.com/ru/users/${login}/posts/page`;

async function getMayBeCached(url) {
    const fileName = `${__dirname}/cache/${md5(url)}.html`;
    if (fs.existsSync(fileName)) {
        return fs.readFileSync(fileName, 'utf8');
    }
    const {data} = await axios.get(url, {
        headers: {
            Cookie: cookie,
            'User-Agent': userAgent,
        }
    });
    fs.writeFileSync(fileName, data, 'utf8');
    return data;
}
const monthes = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
async function processData(match, dateMatch) {
    // console.log(match);
    const [, href, , id, title] = match;
    if(!dateMatch || !dateMatch[1])
    {
        console.log('wrong date');
        console.log(dateMatch);
        process.exit(1);
    }
    let [,date] = dateMatch;
    monthes.forEach((month, index)=>{
        date = date.replace(month, `${index+1}`.padStart(2, '0'));
    })
    date = moment(date.split(' ').join('-'), 'DD-MM-YYYY');
    console.log(`href: ${href}`);
    console.log(`id: ${id}`);
    console.log(`title: ${title}`);
    console.log(`date: ${date}`);
    const editLink = `https://habr.com/ru/topic/edit/${id}/`;
    const data = await getMayBeCached(editLink);
    if(data.includes('Вход — Habr Account'))
    {
        console.log('Auth failed');
        process.exit(1);
    }
    const match2 = [...data.matchAll(contentRegExp)];
    let text = match2[0][1];
    text=text
        .replace('&lt;cut /&gt;', '<!---more-->')
        .replace(/&quot;/g, '"')
    if(text.split('&gt;').length>10) //fuck it's html
    {
        text = text.replace(/&lt;/g, '<');
        text = text.replace(/&gt;/g, '>')
        //text = text.replace(/\n/g, '<br>');
    }
    text = `[Оригинал поста на хабре](https://habr.com/ru/post/${id}})\n\n${text}`;
    let dir = `${__dirname}/posts/${date.format('YYYY')}`;
    if(!fs.existsSync(dir))
    {
        fs.mkdirSync(dir);
    }
    dir = `${dir}/${date.format('MM')}`;
    if(!fs.existsSync(dir))
    {
        fs.mkdirSync(dir);
    }
    const postContent=`---
title: ${title}
tags:
  - habr
date: ${date.format('YYYY')}-${date.format('MM')}-${date.format('DD')} 10:00:00
---

${text}
`;
    const filename = title
        .split(' ')
        .join('-')
        .replace(':', '')
        .replace('?', '')
        .replace(',', '')
        .replace('.', '')
        .replace('»', '')
        .split('-')
        .filter(el=>el)
        .join('-')
        .toLowerCase();
    fs.writeFileSync(`${dir}/${filename}.md`, postContent);
}

async function getPostIds() {
    let postsFound = true;
    for (let i = 0; i < 50 && postsFound; i++) {
        const postPageUrl = `${postsPage}${i}/`;
        const data = await getMayBeCached(postPageUrl);
        const matches = [...data.split('\n').join('').matchAll(headerRegExp)];
        const dates = [...data.split('\n').join('').matchAll(dateRegExp)];
        if (matches.length) {
            for (let z = 0; z < matches.length; z++) {
                console.log(`processing post ${z}`);
                await processData(matches[z], dates[z]);
            }
            //console.log(matches);
        } else {
            postsFound = false;
        }
    }
}

async function main() {
    const ids = await getPostIds();

}

main().then(() => console.log('completed'));
