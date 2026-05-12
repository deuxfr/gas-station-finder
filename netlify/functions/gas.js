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

  // 좌표 숫자형 변환 및 URL 구성
  const x = parseFloat(lng);
  const y = parseFloat(lat);
  const r = parseInt(radius) * 1000;
  const listUrl = `https://www.opinet.co.kr/api/aroundAll.do?code=${API_KEY}&x=${x}&y=${y}&radius=${r}&prodcd=${fuel}&sort=1&out=json&os_nm=WGS84`;

  try {
    const data = await fetch_(listUrl);
    const json = JSON.parse(data);

    // [중요] 오피넷 응답 구조 유연하게 파싱 (대소문자 및 경로 예외 처리)
    let rawList = json?.RESULT?.OIL || json?.result?.oil || json?.RESULT?.oil || [];
    
    // 만약 검색 결과가 1개여서 객체로 올 경우를 대비해 배열로 강제 변환
    if (rawList && !Array.isArray(rawList)) {
      rawList = [rawList];
    }

    const stations = rawList.map(s => ({
      id: s.UNI_ID || s.uni_id,
      name: s.OS_NM || s.os_nm,
      brand: s.POLL_DIV_CD || s.poll_div_cd,
      price: parseInt(s.PRICE || s.price || 0),
      dist: Math.round(s.DISTANCE || s.distance || 0),
      isSelf: (s.SELF_YN || s.self_yn) === "Y",
      is24h: (s.OPNG_HH === "00" || s.opng_hh === "00") && (s.CLSG_HH === "00" || s.clsg_hh === "00")
    }));

    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify(stations) 
    };
  } catch (e) {
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: "데이터 파싱 에러: " + e.message }) 
    };
  }
};

function fetch_(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      res.setEncoding('utf8'); // 한글 깨짐 방지
      let body = "";
      res.on("data", chunk => (body += chunk));
      res.on("end", () => resolve(body));
      res.on("error", reject);
    }).on("error", reject);
  });
}
