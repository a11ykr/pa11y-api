const axios = require('axios');
const cheerio = require('cheerio');

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

	// GET 요청 처리 - 간단한 상태 확인
	if (req.method === 'GET') {
		return res.status(200).json({
			status: 'ok',
			message: 'Simple accessibility API is running. Use POST method with a URL to check accessibility.',
			example: {
				method: 'POST',
				body: { url: 'https://example.com' }
			}
		});
	}

	// POST 요청 처리
	if (req.method === 'POST') {
		try {
			const body = req.body;

			// URL 필수 확인
			if (!body || !body.url) {
				return res.status(400).json({
					error: 'URL is required',
					example: { url: 'https://example.com' }
				});
			}

			// URL에서 HTML 가져오기
			const response = await axios.get(body.url, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
				},
				timeout: 10000 // 10초 타임아웃
			});

			const html = response.data;
			const $ = cheerio.load(html);

			// 간단한 접근성 검사 수행
			const issues = [];

			// 1. 이미지의 alt 속성 확인
			$('img').each((index, element) => {
				const alt = $(element).attr('alt');
				if (!alt && !$(element).attr('role') === 'presentation') {
					issues.push({
						type: 'error',
						code: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37',
						message: 'Images must have alternative text',
						selector: element.name + ($(element).attr('id') ? '#' + $(element).attr('id') : ''),
						context: $.html(element).substring(0, 100)
					});
				}
			});

			// 2. 링크 텍스트 확인
			$('a').each((index, element) => {
				const text = $(element).text().trim();
				const ariaLabel = $(element).attr('aria-label');
				const title = $(element).attr('title');

				if (!text && !ariaLabel && !title) {
					issues.push({
						type: 'error',
						code: 'WCAG2AA.Principle2.Guideline2_4.2_4_4.H91',
						message: 'Link must have discernible text',
						selector: element.name + ($(element).attr('id') ? '#' + $(element).attr('id') : ''),
						context: $.html(element).substring(0, 100)
					});
				}
			});

			// 3. 폼 레이블 확인
			$('input:not([type="hidden"]), select, textarea').each((index, element) => {
				const id = $(element).attr('id');
				const ariaLabel = $(element).attr('aria-label');
				const ariaLabelledby = $(element).attr('aria-labelledby');

				if (id && $(`label[for="${id}"]`).length === 0 && !ariaLabel && !ariaLabelledby) {
					issues.push({
						type: 'error',
						code: 'WCAG2AA.Principle1.Guideline1_3.1_3_1.H44',
						message: 'Form control missing a label',
						selector: element.name + (id ? '#' + id : ''),
						context: $.html(element).substring(0, 100)
					});
				}
			});

			// 4. 헤딩 구조 확인
			const headings = [];
			for (let i = 1; i <= 6; i++) {
				$(`h${i}`).each((index, element) => {
					headings.push({
						level: i,
						text: $(element).text().trim()
					});
				});
			}

			// 헤딩 레벨 건너뛰기 검사
			for (let i = 0; i < headings.length - 1; i++) {
				if (headings[i + 1].level > headings[i].level + 1) {
					issues.push({
						type: 'warning',
						code: 'WCAG2AA.Principle1.Guideline1_3.1_3_1_AAA.G141',
						message: `Heading levels should not be skipped: h${headings[i].level} to h${headings[i + 1].level}`,
						context: `${headings[i].text} ... ${headings[i + 1].text}`.substring(0, 100)
					});
				}
			}

			// 결과 반환
			return res.status(200).json({
				status: 'success',
				pageUrl: body.url,
				documentTitle: $('title').text() || 'Unknown',
				timestamp: new Date().toISOString(),
				issues: issues,
				summary: {
					total: issues.length,
					errors: issues.filter(i => i.type === 'error').length,
					warnings: issues.filter(i => i.type === 'warning').length,
					notices: issues.filter(i => i.type === 'notice').length
				}
			});

		} catch (error) {
			console.error('Error:', error);
			return res.status(500).json({
				error: 'Failed to check accessibility',
				message: error.message
			});
		}
	}

	// 지원되지 않는 HTTP 메서드
	return res.status(405).json({ error: 'Method not allowed' });
};