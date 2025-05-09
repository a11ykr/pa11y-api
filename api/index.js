module.exports = async (req, res) => {
	// CORS 헤더
	res.setHeader('Access-Control-Allow-Credentials', true);
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
	res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

	if (req.method === 'OPTIONS') {
		return res.status(200).end();
	}

	// 경로에 따라 다른 처리
	if (req.url === '/api/check' && req.method === 'POST') {
		return res.status(200).json({ message: "Check API is working!" });
	}

	// 기본 응답
	return res.status(404).json({ error: "Not found" });
};