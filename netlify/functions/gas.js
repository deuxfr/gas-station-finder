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

  // API 호출 URL (os_nm=WGS84는 여기서 한 번만 명시)
  const listUrl = `https://www.opinet.co.kr/api/aroundAll.do?code=${API_KEY}&x=${lng}&y=${lat}&radius=${parseInt(radius) * 1000}&prodcd=${fuel}&sort=1&out=json&os_nm=WGS84`;

  try {
    const data = await fetch_(listUrl);
    const json = JSON.parse(data);

    // 데이터가 없는 경우 빈 배열 반환
    const rawStations = json?.RESULT?.OIL || [];
    
    const stations = rawStations.map(s => ({
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
    https.get(url, res => {
      let body = "";
      res.on("data", chunk => (body += chunk));
      res.on("end", () => resolve(body));
      res.on("error", reject);
    }).on("error", reject);
  });
}
