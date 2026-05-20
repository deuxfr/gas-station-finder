const https = require("https");

// WGS84(위경도) → KATEC 좌표 변환
function wgs84ToKatec(lat, lon) {
  const PI = Math.PI;
  const KATEC = {
    a: 6377397.155, e2: 0.006674372230614,
    lon0: 128 * PI / 180, lat0: 38 * PI / 180,
    k0: 0.9999, dx: 400000, dy: 600000
  };
  const { a, e2, lon0, lat0, k0, dx, dy } = KATEC;
  const e = Math.sqrt(e2);
  const phi  = lat * PI / 180;
  const lam  = lon * PI / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const T = Math.tan(phi) ** 2;
  const C = (e2 / (1 - e2)) * Math.cos(phi) ** 2;
  const A = Math.cos(phi) * (lam - lon0);
  const M = a * (
    (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256) * phi
    - (3*e2/8 + 3*e2**2/32 + 45*e2**3/1024) * Math.sin(2*phi)
    + (15*e2**2/256 + 45*e2**3/1024) * Math.sin(4*phi)
    - (35*e2**3/3072) * Math.sin(6*phi)
  );
  const M0 = a * (
    (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256) * lat0
    - (3*e2/8 + 3*e2**2/32 + 45*e2**3/1024) * Math.sin(2*lat0)
    + (15*e2**2/256 + 45*e2**3/1024) * Math.sin(4*lat0)
    - (35*e2**3/3072) * Math.sin(6*lat0)
  );
  const x = dx + k0 * N * (A + (1-T+C)*A**3/6 + (5-18*T+T**2+72*C-58*(e2/(1-e2)))*A**5/120);
  const y = dy + k0 * (M - M0 + N*Math.tan(phi)*(A**2/2 + (5-T+9*C+4*C**2)*A**4/24 + (61-58*T+T**2+600*C-330*(e2/(1-e2)))*A**6/720));
  return { x: Math.round(x), y: Math.round(y) };
}

exports.handler = async function (event) {
  const { lat, lng, radius, fuel } = event.queryStringParameters || {};
  const API_KEY = process.env.OPINET_API_KEY;

  if (!lat || !lng || !radius || !fuel || !API_KEY) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: !API_KEY ? "API 키 미설정 (환경변수 OPINET_API_KEY 확인)" : "파라미터 누락" })
    };
  }

  // WGS84 → KATEC 변환
  const { x, y } = wgs84ToKatec(parseFloat(lat), parseFloat(lng));
  const radiusM  = parseInt(radius) * 1000; // km → m

  const url =
    `https://www.opinet.co.kr/api/aroundAll.do` +
    `?code=${API_KEY}&x=${x}&y=${y}&radius=${radiusM}` +
    `&prodcd=${fuel}&sort=1&out=json`;

  try {
    const raw  = await fetch_(url);
    const json = JSON.parse(raw);

    // 오피넷 오류 응답 처리
    if (json?.RESULT?.OIL_CNT === 0 || !json?.RESULT?.OIL) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify([])
      };
    }

    const stations = json.RESULT.OIL.map(s => ({
      id:    s.UNI_ID,
      name:  s.OS_NM,
      brand: s.POLL_DIV_CD,
      price: Number(s.PRICE),
      dist:  Math.round(Number(s.DISTANCE)),
      is24h: s.OPNG_HH === "0000" && s.CLSG_HH === "2400",
      isSelf: s.SELF_YN === "Y",
    })).filter(s => s.price > 0); // 가격 없는 항목 제거

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(stations)
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: e.message })
    };
  }
};

function fetch_(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let body = "";
      res.on("data", c => (body += c));
      res.on("end", () => resolve(body));
      res.on("error", reject);
    }).on("error", reject);
  });
}
