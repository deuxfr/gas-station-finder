const https = require("https");

exports.handler = async function (event) {
  const { lat, lng, radius, fuel } = event.queryStringParameters || {};
  const API_KEY = process.env.OPINET_API_KEY;

  if (!lat || !lng || !radius || !fuel) {
    return { 
      statusCode: 400, 
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "파라미터 누락" }) 
    };
  }

  // 핵심 수정: &os_nm=WGS84 파라미터를 추가하여 브라우저 위경도 좌표를 오피넷이 인식하게 함
  const listUrl =
    `https://www.opinet.co.kr/api/aroundAll.do` +
    `?code=${API_KEY}&x=${lng}&y=${lat}&radius=${parseInt(radius) * 1000}` +
    `&prodcd=${fuel}&sort=1&out=json&os_nm=WGS84`;

  try {
    const data = await fetch_(listUrl);
    const json = JSON.parse(data);
    
    // 오피넷 응답에서 데이터 추출
    const stations = (json?.RESULT?.OIL || []).map(s => ({
      id:     s.UNI_ID,
      name:   s.OS_NM,
      brand:  s.POLL_DIV_CD,
      price:  s.PRICE,
      dist:   Math.round(s.DISTANCE),
      x:      s.GIS_X_COOR,
      y:      s.GIS_Y_COOR,
      // 24시간 영업 여부 추가 (오피넷 응답값 기준)
      is24h:  s.OPNG_HH === "0" && s.CLSG_HH === "0",
      isSelf: s.SELF_YN === "Y",
    }));

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" // 프론트엔드 호출 허용
      },
      body: JSON.stringify(stations),
    };
  } catch (e) {
    return { 
      statusCode: 500, 
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: e.message }) 
    };
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
