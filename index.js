const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const port = 8080;

app.use(cors());
app.use(express.json());

app.post('/monitor', async (req, res) => {
  const { url } = req.body;
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setRequestInterception(true);

  const requests = [];

  page.on('request', async (request) => {
    if (request.method() === 'OPTIONS') {
      // Ignore preflight requests
      request.continue();
      return;
    }

    const startTime = Date.now();

    request.continue();

    page.on('requestfinished', async (finishedRequest) => {
      if (finishedRequest._requestId === request._requestId) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        try {
          const response = await finishedRequest.response();
          const responseBody = await response.text();

          requests.push({
            url: request.url(),
            headers: request.headers(),
            method: request.method(),
            postData: request.postData(),
            responseHeaders: response.headers(),
            responseStatus: response.status(),
            responseBody,
            timing: {
              startTime,
              endTime,
              duration,
            },
          });
        } catch (error) {
          console.error(`Error loading body for request ${request.url()}:`, error.message);
        }
      }
    });
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle0' });
  } catch (error) {
    console.error(`Error navigating to ${url}:`, error.message);
  } finally {
    await browser.close();
  }

  res.json(requests);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
