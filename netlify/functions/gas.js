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

  // 좌표 정밀도 최적화 (x: 경도, y: 위도)
  const x = parseFloat(lng).toFixed(7);
  const y = parseFloat(lat).toFixed(7);
  const r = parseInt(radius) * 1000;

  // 오피넷 서버가 거절할 수 없는 표준 URL 구조
  const listUrl = `https://www.opinet.co.kr/api/aroundAll.do?code=${API_KEY}&x=${x}&y=${y}&radius=${r}&prodcd=${fuel}&sort=1&out=json&os_nm=WGS84`;

  try {
    const responseBody = await fetchFromOpinet(listUrl);
    const json = JSON.parse(responseBody);

    // 오피넷 응답에서 OIL 리스트 추출 (대소문자 모두 방어)
    let rawList = json?.RESULT?.OIL || json?.result?.oil || [];
    
    // 데이터가 아예 없을 때 (오피넷 에러 코드 확인)
    if (!Array.isArray(rawList)) {
      if (typeof rawList === 'object' && rawList !== null) {
        rawList = [rawList]; // 단일 객체일 경우 배열화
      } else {
        // 결과가 아예 없을 경우 오피넷이 보낸 원본 메시지 확인용
        return { 
          statusCode: 200, 
          headers, 
          body: JSON.stringify({ error: "검색 결과 없음", debug: json }) 
        };
      }
    }

    const stations = rawList.map(s => ({
      id: s.UNI_ID || s.uni_id,
      name: s.OS_NM || s.os_nm,
      brand: s.POLL_DIV_CD || s.poll_div_cd,
      price: parseInt(s.PRICE || s.price || 0),
      dist: Math.round(s.DISTANCE || s.distance || 0),
      isSelf: (s.SELF_YN || s.self_yn) === "Y",
      is24h: (s.OPNG_HH === "00" || s.opng_hh === "00") && (s.CLSG_HH === "00" || s.clsg_hh === "00")
    })).filter(s => s.price > 0);

    return { statusCode: 200, headers, body: JSON.stringify(stations) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "API 응답 해석 실패: " + e.message }) };
  }
};

function fetchFromOpinet(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.opinet.co.kr/'
      }
    };
    https.get(url, options, (res) => {
      res.setEncoding('utf8');
      let body = "";
      res.on("data", chunk => (body += chunk));
      res.on("end", () => resolve(body));
      res.on("error", reject);
    }).on("error", reject);
  });
}
