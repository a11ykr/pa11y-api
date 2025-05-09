// api/check.js
const axios = require('axios');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const axeCore = require('axe-core');

module.exports = async (req, res) => {
	// CORS 헤더 설정
	res.setHeader('Access-Control-Allow-Credentials', true);
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
	res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

	if (req.method === 'OPTIONS') {
		return res.status(200).end();
	}

	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const body = req.body;

		if (!body || !body.url) {
			return res.status(400).json({ error: 'URL is required' });
		}

		// URL에서 HTML 가져오기
		const response = await axios.get(body.url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
			},
			timeout: 30000
		});

		const html = response.data;

		// JSDOM으로 DOM 생성
		const dom = new JSDOM(html, {
			url: body.url,
			resources: "usable",
			runScripts: "dangerously"  // 이 옵션은 주의해서 사용
		});

		// axe-core 설정
		const axe = axeCore.source;
		const window = dom.window;
		const document = window.document;

		// axe-core 주입
		window.eval(axe);

		// axe-core 실행
		const results = await new Promise((resolve, reject) => {
			window.axe.run(document, {
				rules: body.rules || []
			}, (err, results) => {
				if (err) reject(err);
				resolve(results);
			});
		});

		// 메모리 누수 방지
		window.close();

		// 결과 처리
		const violations = results.violations.map(violation => ({
			id: violation.id,
			impact: violation.impact,
			description: violation.description,
			help: violation.help,
			helpUrl: violation.helpUrl,
			nodes: violation.nodes.map(node => ({
				html: node.html,
				target: node.target,
				any: node.any.map(check => check.message),
				all: node.all.map(check => check.message),
				none: node.none.map(check => check.message)
			}))
		}));

		// pa11y 형식과 유사하게 변환
		const issueTypes = {
			'critical': 'error',
			'serious': 'error',
			'moderate': 'warning',
			'minor': 'notice'
		};

		const issues = violations.flatMap(violation =>
			violation.nodes.map(node => ({
				type: issueTypes[violation.impact] || 'warning',
				code: violation.id,
				message: `${violation.help} (${violation.description})`,
				context: node.html,
				selector: node.target.join(' '),
				helpUrl: violation.helpUrl
			}))
		);

		return res.status(200).json({
			pageUrl: body.url,
			testRunner: 'axe-core',
			documentTitle: document.title || 'Unknown',
			issues: issues,
			summary: {
				total: issues.length,
				errors: issues.filter(i => i.type === 'error').length,
				warnings: issues.filter(i => i.type === 'warning').length,
				notices: issues.filter(i => i.type === 'notice').length
			},
			timestamp: new Date().toISOString()
		});

	} catch (error) {
		console.error('Error:', error);
		return res.status(500).json({
			error: 'Failed to check accessibility',
			message: error.message
		});
	}
};