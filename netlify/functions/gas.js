const https = require("https");

exports.handler = async function (event) {
  const { lat, lng, radius, fuel } = event.queryStringParameters || {};
  const API_KEY = process.env.OPINET_API_KEY;

  if (!lat || !lng || !radius || !fuel) {
    return { statusCode: 400, body: JSON.stringify({ error: "파라미터 누락" }) };
  }

  // 오피넷 API: 위경도(WGS84) 사용을 위해 out=json 뒤에 &os_nm=WGS84 추가 권장
  const listUrl =
    `https://www.opinet.co.kr/api/aroundAll.do` +
    `?code=${API_KEY}&x=${lng}&y=${lat}&radius=${parseInt(radius) * 1000}` +
    `&prodcd=${fuel}&sort=1&out=json`;

  try {
    const data = await fetch_(listUrl);
    const json = JSON.parse(data);
    
    // 오피넷 응답 객체 구조 확인 (json.RESULT.OIL)
    const stations = (json?.RESULT?.OIL || []).map(s => ({
      id:     s.UNI_ID,
      name:   s.OS_NM,
      brand:  s.POLL_DIV_CD,
      price:  s.PRICE,
      dist:   Math.round(s.DISTANCE),
      x:      s.GIS_X_COOR,
      y:      s.GIS_Y_COOR,
      // 오피넷 응답값에 따른 조건 수정 (필요 시)
      isSelf: s.SELF_YN === "Y",
    }));

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" // CORS 대응
      },
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
