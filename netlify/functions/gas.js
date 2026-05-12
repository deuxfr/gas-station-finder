const https = require("https");

exports.handler = async function (event, context) {
  // Netlify에서 제공하는 process.env를 명시적으로 참조
  const API_KEY = process.env.OPINET_API_KEY || process.env.opinet_api_key;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };

  // API 키가 아예 인식되지 않는 경우
  if (!API_KEY) {
    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ error: "API 키가 서버에 등록되지 않았습니다. Netlify 설정을 확인하세요." }) 
    };
  }

  const { lat, lng, radius, fuel } = event.queryStringParameters || {};
  if (!lat || !lng) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: "위치 정보가 없습니다." }) };
  }

  const x = parseFloat(lng).toFixed(7);
  const y = parseFloat(lat).toFixed(7);
  const r = parseInt(radius || 1) * 1000;
  const listUrl = `https://www.opinet.co.kr/api/aroundAll.do?code=${API_KEY}&x=${x}&y=${y}&radius=${r}&prodcd=${fuel || 'B027'}&sort=1&out=json&os_nm=WGS84`;

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

    if (json.RESULT && json.RESULT.CODE !== "000") {
      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify({ error: `오피넷 응답 오류: ${json.RESULT.MESSAGE}`, debug: json }) 
      };
    }

    let rawList = json?.RESULT?.OIL || [];
    if (!Array.isArray(rawList)) rawList = rawList ? [rawList] : [];

    const stations = rawList.map(s => ({
      id: s.UNI_ID, name: s.OS_NM, brand: s.POLL_DIV_CD,
      price: parseInt(s.PRICE), dist: Math.round(s.DISTANCE),
      isSelf: s.SELF_YN === "Y", is24h: s.OPNG_HH === "00" && s.CLSG_HH === "00"
    }));

    return { statusCode: 200, headers, body: JSON.stringify(stations) };
  } catch (e) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: "연결 실패: " + e.message }) };
  }
};
