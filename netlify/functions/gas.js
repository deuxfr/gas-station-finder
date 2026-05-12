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

  // 1. 숫자형 변환 확인: 위경도가 문자열로 인식되어 오차가 생기는 경우 방지
  const x = parseFloat(lng);
  const y = parseFloat(lat);
  const r = parseInt(radius) * 1000;

  const listUrl = `https://www.opinet.co.kr/api/aroundAll.do?code=${API_KEY}&x=${x}&y=${y}&radius=${r}&prodcd=${fuel}&sort=1&out=json&os_nm=WGS84`;

  try {
    const data = await fetch_(listUrl);
    const json = JSON.parse(data);

    // 2. 오피넷 응답 메시지 확인: 결과가 없을 때 이유가 포함되어 오는지 체크
    if (!json?.RESULT?.OIL) {
      // 만약 RESULT 안에 에러 코드가 있다면 프론트로 전달 (디버깅용)
      const errorMsg = json?.RESULT?.ERROR_MSG || "검색 결과가 없습니다.";
      return { statusCode: 200, headers, body: JSON.stringify({ error: errorMsg, raw: json }) };
    }

    const stations = json.RESULT.OIL.map(s => ({
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
      // 3. 인코딩 문제 해결: 한글 이름이 포함된 응답이 깨지지 않도록 처리
      res.setEncoding('utf8'); 
      let body = "";
      res.on("data", chunk => (body += chunk));
      res.on("end", () => resolve(body));
      res.on("error", reject);
    }).on("error", reject);
  });
}
