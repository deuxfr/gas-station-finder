const https = require("https");

exports.handler = async function (event) {
  const { lat, lng, radius, fuel } = event.queryStringParameters || {};
  const API_KEY = process.env.OPINET_API_KEY;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };

  if (!lat || !lng || !radius || !fuel) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "파라미터 누락" }) };
  }

  // 핵심: x는 경도(lng), y는 위도(lat)입니다. 
  // parseFloat 후 고정 소수점으로 변환하여 전달
  const x = parseFloat(lng).toFixed(6);
  const y = parseFloat(lat).toFixed(6);
  const r = parseInt(radius) * 1000;

  // URL 구성 시 파라미터 순서 재확인
  const listUrl = `https://www.opinet.co.kr/api/aroundAll.do?code=${API_KEY}&x=${x}&y=${y}&radius=${r}&prodcd=${fuel}&sort=1&out=json&os_nm=WGS84`;

  try {
    const data = await fetch_(listUrl);
    const json = JSON.parse(data);

    // 데이터 추출부 보강
    let rawList = json?.RESULT?.OIL || [];
    if (rawList && !Array.isArray(rawList)) rawList = [rawList];

    const stations = rawList.map(s => ({
      id: s.UNI_ID,
      name: s.OS_NM,
      brand: s.POLL_DIV_CD,
      price: parseInt(s.PRICE),
      dist: Math.round(s.DISTANCE),
      isSelf: s.SELF_YN === "Y",
      is24h: s.OPNG_HH === "00" && s.CLSG_HH === "00"
    }));

    return { statusCode: 200, headers, body: JSON.stringify(stations) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};

function fetch_(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      res.setEncoding('utf8');
      let body = "";
      res.on("data", chunk => (body += chunk));
      res.on("end", () => resolve(body));
      res.on("error", reject);
    }).on("error", reject);
  });
}
