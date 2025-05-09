const axios = require('axios');
const cheerio = require('cheerio');
const validator = require('html-validator');

module.exports = async (req, res) => {
	// CORS 헤더 설정
	res.setHeader('Access-Control-Allow-Credentials', true);
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
	res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

	// OPTIONS 요청 처리
	if (req.method === 'OPTIONS') {
		return res.status(200).end();
	}

	// POST 요청만 허용
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const body = req.body;

		// URL 필수
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
		const $ = cheerio.load(html);

		// 기본 접근성 체크 수행
		const issues = [];

		// 1. 이미지의 alt 속성 확인
		$('img').each((index, element) => {
			const alt = $(element).attr('alt');
			if (!alt) {
				issues.push({
					type: 'error',
					code: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37',
					message: 'Image elements must have an alt attribute',
					context: $.html(element),
					selector: getSelector(element)
				});
			}
		});

		// 2. 폼 요소의 레이블 확인
		$('input, select, textarea').each((index, element) => {
			const id = $(element).attr('id');
			const ariaLabel = $(element).attr('aria-label');
			const ariaLabelledby = $(element).attr('aria-labelledby');

			if (id && $(`label[for="${id}"]`).length === 0 && !ariaLabel && !ariaLabelledby) {
				issues.push({
					type: 'error',
					code: 'WCAG2AA.Principle1.Guideline1_3.1_3_1.H44',
					message: 'Form element must have a label',
					context: $.html(element),
					selector: getSelector(element)
				});
			}
		});

		// 3. 링크의 접근성 확인
		$('a').each((index, element) => {
			const text = $(element).text().trim();
			const ariaLabel = $(element).attr('aria-label');

			if (!text && !ariaLabel) {
				issues.push({
					type: 'error',
					code: 'WCAG2AA.Principle2.Guideline2_4.2_4_4.H91',
					message: 'Link must have discernible text',
					context: $.html(element),
					selector: getSelector(element)
				});
			}
		});

		// 4. 헤딩 구조 확인
		const headings = [];
		$('h1, h2, h3, h4, h5, h6').each((index, element) => {
			const level = parseInt(element.tagName.substring(1));
			headings.push(level);
		});

		for (let i = 1; i < headings.length; i++) {
			if (headings[i] > headings[i - 1] + 1) {
				issues.push({
					type: 'warning',
					code: 'WCAG2AA.Principle1.Guideline1_3.1_3_1_AAA.G141',
					message: 'Heading levels should not be skipped',
					context: `Heading level jumped from h${headings[i - 1]} to h${headings[i]}`,
					selector: `h${headings[i]}`
				});
			}
		}

		// 5. HTML 유효성 검사
		try {
			const htmlValidation = await validator({
				data: html,
				format: 'json'
			});

			htmlValidation.messages.forEach(message => {
				if (message.type === 'error') {
					issues.push({
						type: 'notice',
						code: 'HTML.Validation',
						message: message.message,
						context: message.extract || '',
						selector: ''
					});
				}
			});
		} catch (validationError) {
			console.log('HTML validation error:', validationError);
			// 검증 오류가 발생해도 계속 진행
		}

		// 결과 반환
		return res.status(200).json({
			pageUrl: body.url,
			testRunner: 'lightweight-a11y-checker',
			documentTitle: $('title').text() || 'Unknown',
			issues: issues,
			summary: {
				errors: issues.filter(i => i.type === 'error').length,
				warnings: issues.filter(i => i.type === 'warning').length,
				notices: issues.filter(i => i.type === 'notice').length
			},
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('Error checking accessibility:', error);
		return res.status(500).json({
			error: 'Failed to check accessibility',
			message: error.message
		});
	}
};

// 요소의 CSS 선택자를 가져오는 함수
function getSelector(element) {
	let selector = element.tagName.toLowerCase();

	if (element.attribs && element.attribs.id) {
		selector += `#${element.attribs.id}`;
	} else if (element.attribs && element.attribs.class) {
		selector += `.${element.attribs.class.replace(/\s+/g, '.')}`;
	}

	return selector;
}