const https = require("https");

exports.handler = async function (event) {
  const { lat, lng, radius, fuel } = event.queryStringParameters || {};
  const API_KEY = process.env.OPINET_API_KEY;
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

  if (!API_KEY) return { statusCode: 200, headers, body: JSON.stringify({ error: "키 미설정" }) };

  // 핵심 수정: 숫자로 변환 후 소수점 6자리까지 고정 (오피넷 권장 포맷)
  const x = Number(lng).toFixed(6); // 경도
  const y = Number(lat).toFixed(6); // 위도
  const r = parseInt(radius) * 1000;

  // os_nm=WGS84를 명시적으로 전달
  const listUrl = `https://www.opinet.co.kr/api/aroundAll.do?code=${API_KEY}&x=${x}&y=${y}&radius=${r}&prodcd=${fuel}&sort=1&out=json&os_nm=WGS84`;

  try {
    const responseBody = await new Promise((resolve, reject) => {
      const options = { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.opinet.co.kr/' } };
      https.get(listUrl, options, (res) => {
        let body = "";
        res.on("data", chunk => body += chunk);
        res.on("end", () => resolve(body));
        res.on("error", reject);
      });
    });

    const json = JSON.parse(responseBody);
    
    // 오피넷 응답 구조 확인 (대문자 RESULT 하위의 OIL)
    let rawList = json?.RESULT?.OIL || [];
    if (!Array.isArray(rawList)) rawList = rawList ? [rawList] : [];

    const stations = rawList.map(s => ({
      name: s.OS_NM,
      price: parseInt(s.PRICE),
      dist: Math.round(s.DISTANCE),
      isSelf: s.SELF_YN === "Y"
    }));

    // 만약 데이터가 여전히 비어있다면, 오피넷이 보낸 원본 메시지를 그대로 전달 (디버깅용)
    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify(stations.length > 0 ? stations : { error: "데이터 없음", raw: json }) 
    };

  } catch (e) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: e.message }) };
  }
};
