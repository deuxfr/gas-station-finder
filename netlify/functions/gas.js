const https = require("https");

exports.handler = async function (event) {
  const { lat, lng, radius, fuel } = event.queryStringParameters || {};
  // Netlify 설정의 환경변수에서 키를 가져옵니다.
  const API_KEY = process.env.OPINET_API_KEY;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };

  // 1. 서버 환경변수 체크
  if (!API_KEY) {
    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ error: "환경변수 설정 오류: Netlify에서 OPINET_API_KEY를 설정하고 다시 배포하세요." }) 
    };
  }

  const x = parseFloat(lng).toFixed(7);
  const y = parseFloat(lat).toFixed(7);
  const r = parseInt(radius) * 1000;
  const listUrl = `https://www.opinet.co.kr/api/aroundAll.do?code=${API_KEY}&x=${x}&y=${y}&radius=${r}&prodcd=${fuel}&sort=1&out=json&os_nm=WGS84`;

  try {
    const responseBody = await new Promise((resolve, reject) => {
      const options = { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.opinet.co.kr/' } };
      https.get(listUrl, options, (res) => {
        res.setEncoding('utf8');
        let body = "";
        res.on("data", chunk => (body += chunk));
        res.on("end", () => resolve(body));
        res.on("error", reject);
      }).on("error", reject);
    });

    const json = JSON.parse(responseBody);

    // 2. 오피넷 응답 결과 분석
    if (json.RESULT && json.RESULT.CODE !== "000") {
      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify({ error: `오피넷 서버 메시지: ${json.RESULT.MESSAGE}`, debug: json }) 
      };
    }

    let rawList = json?.RESULT?.OIL || [];
    if (!Array.isArray(rawList)) rawList = rawList ? [rawList] : [];

    const stations = rawList.map(s => ({
      id: s.UNI_ID, name: s.OS_NM, brand: s.POLL_DIV_CD,
      price: parseInt(s.PRICE), dist: Math.round(s.DISTANCE),
      isSelf: s.SELF_YN === "Y", is24h: s.OPNG_HH === "00" && s.CLSG_HH === "00"
    })).filter(s => s.price > 0);

    return { statusCode: 200, headers, body: JSON.stringify(stations) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "통신 에러: " + e.message }) };
  }
};
