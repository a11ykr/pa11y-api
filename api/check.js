const pa11y = require('pa11y');
const chromium = require('chrome-aws-lambda');

module.exports = async (req, res) => {
	// CORS 헤더 설정
	res.setHeader('Access-Control-Allow-Credentials', true);
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
	res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

	// OPTIONS 요청 처리 (CORS preflight)
	if (req.method === 'OPTIONS') {
		return res.status(200).end();
	}

	// POST 요청이 아닌 경우 에러 반환
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const body = req.body;

		// URL이 없는 경우 에러 반환
		if (!body || !body.url) {
			return res.status(400).json({ error: 'URL is required' });
		}

		// pa11y 옵션 설정
		const options = {
			standard: body.standard || 'WCAG2AA',
			timeout: body.timeout || 60000,
			waitUntil: body.waitUntil || 'networkidle0',
			chromeLaunchConfig: {
				executablePath: await chromium.executablePath,
				args: chromium.args,
				headless: chromium.headless,
				defaultViewport: chromium.defaultViewport,
				ignoreHTTPSErrors: true,
			}
		};

		// pa11y 실행
		const results = await pa11y(body.url, options);

		// 결과 반환
		return res.status(200).json({
			pageUrl: body.url,
			testRunner: results.testRunner,
			issues: results.issues,
			documentTitle: results.documentTitle,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('Error running pa11y:', error);
		return res.status(500).json({
			error: 'Failed to run accessibility test',
			message: error.message
		});
	}
};