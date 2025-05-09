const pa11y = require('pa11y');
const chromium = require('chrome-aws-lambda');

module.exports = async (req, res) => {
	// CORS 헤더 설정
	res.setHeader('Access-Control-Allow-Credentials', true);
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
	res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

	// OPTIONS 요청 처리 (CORS 프리플라이트)
	if (req.method === 'OPTIONS') {
		return res.status(200).end();
	}

	// POST 요청만 처리
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		// 요청 본문에서 URL 가져오기
		const { url } = req.body;

		if (!url) {
			return res.status(400).json({ error: 'URL is required' });
		}

		console.log(`접근성 검사 요청 받음: ${url}`);

		// Chromium 브라우저 설정
		const browser = await chromium.puppeteer.launch({
			args: chromium.args,
			defaultViewport: chromium.defaultViewport,
			executablePath: await chromium.executablePath,
			headless: true,
			ignoreHTTPSErrors: true,
		});

		// pa11y 실행 옵션
		const options = {
			browser: browser,
			timeout: 30000,
			wait: 1000,
			log: {
				debug: console.log,
				error: console.error,
				info: console.info
			}
		};

		// pa11y 실행
		const results = await pa11y(url, options);

		// 브라우저 종료
		await browser.close();

		// 응답 반환
		return res.status(200).json({
			status: "success",
			message: "접근성 검사 완료",
			url: url,
			timestamp: new Date().toISOString(),
			results: results.issues
		});
	} catch (error) {
		console.error(`오류 발생: ${error.message}`);
		console.error(error.stack);

		return res.status(500).json({
			status: "error",
			message: "접근성 검사 중 오류 발생",
			error: error.message,
			stack: error.stack
		});
	}
};