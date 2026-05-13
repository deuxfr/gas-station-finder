const https = require("https");

exports.handler = async function (event) {
  const { lat, lng, radius, fuel } = event.queryStringParameters || {};
  const API_KEY = process.env.OPINET_API_KEY;

  if (!lat || !lng || !radius || !fuel) {
    return { statusCode: 400, body: JSON.stringify({ error: "파라미터 누락" }) };
  }

  // 오피넷: 반경 내 주유소 목록 조회
  const listUrl =
    `https://www.opinet.co.kr/api/aroundAll.do` +
    `?code=${API_KEY}&x=${lng}&y=${lat}&radius=${parseInt(radius) * 1000}` +
    `&prodcd=${fuel}&sort=1&out=json`;

  try {
    const data = await fetch_(listUrl);
    const json = JSON.parse(data);
    const stations = (json?.RESULT?.OIL || []).map(s => ({
      id:    s.UNI_ID,
      name:  s.OS_NM,
      brand: s.POLL_DIV_CD,
      price: s.PRICE,
      dist:  Math.round(s.DISTANCE),
      x:     s.GIS_X_COOR,
      y:     s.GIS_Y_COOR,
      is24h: s.OPNG_HH === "0" && s.CLSG_HH === "0",
      isSelf: s.SELF_YN === "Y",
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stations),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
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
