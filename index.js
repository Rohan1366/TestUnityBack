const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
const port = 8080 || 8081;

app.use(cors());
app.use(express.json());

app.post('/monitor', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).send('URL is required');
  }

  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
      executablePath: process.env.CHROME_BIN || null // Ensure Chrome executable is found
    });
    const page = await browser.newPage();
    await page.goto(url);

    const requests = [];
    page.on('requestfinished', async (request) => {
      const response = await request.response();
      const requestData = {
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData(),
        response: await response.text(),
        responseStatus: response.status(),
        timing: null,
      };
      requests.push(requestData);
    });

    // Wait for a few seconds to collect the requests
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10000)));

    // Collect request timing data using performance API
    const performanceEntries = await page.evaluate(() => performance.getEntriesByType('resource'));
    performanceEntries.forEach(entry => {
      const request = requests.find(req => req.url === entry.name);
      if (request) {
        request.timing = {
          startTime: entry.startTime,
          duration: entry.duration,
        };
      }
    });

    await browser.close();

    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error monitoring network requests');
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
