#!/bin/bash
# Phase 1 URL cleanup — acceptance-criteria verify script.
# Run AFTER: (1) Firestore migration (migrate-phase1-url-cleanup.js) has run, and
#            (2) functions/index.js + the static content changes are deployed.
# Exit 0 = all checks pass, 1 = at least one failure.
set -u
BASE="https://keolaigiamhom.vn"
FAIL=0

pass() { printf "  \033[32mPASS\033[0m %s\n" "$1"; }
fail() { printf "  \033[31mFAIL\033[0m %s\n" "$1"; FAIL=1; }

# slug -> expected canonical slug it should 301 to
declare -a REDIRECT_PAIRS=(
  "lua-chon-giong-keo-lai-phu-hop-khi-hau-tay-nguyen:chon-giong-keo-lai-phu-hop-vung-tay-nguyen"
  "tap-huan-cham-soc-cay-keo-lai-non-mua-mua-tay-nguyen:cham-soc-cay-non-keo-lai-mua-mua-vung-cao-tay-nguyen"
  "dinh-duong-cay-keo-lai-con-mua-mua-tay-nguyen:cham-soc-cay-non-keo-lai-mua-mua-vung-cao-tay-nguyen"
  "chi-phi-trong-keo-lai-1-hecta-mua-mua:chi-phi-trong-1-ha-keo-lai"
  "chi-phi-chuan-bi-dat-trong-keo-lai-mua-mua:chi-phi-trong-1-ha-keo-lai"
  "quy-trinh-bon-phan-keo-lai:bon-phan-cho-keo-lai"
  "bon-phan-keo-lai-con-sau-khi-trong:bon-phan-cho-keo-lai"
  "phan-bon-npk-cho-keo-lai:bon-phan-cho-keo-lai"
  "phan-bon-huu-co-keo-lai-kien-thiet:su-dung-phan-huu-co-keo-lai-kien-thiet"
  "quy-trinh-tia-canh-tao-tan-keo-lai-kien-thiet:ky-thuat-tia-canh-tao-tan-keo-lai-kien-thiet"
  "ky-thuat-tia-canh-tao-tan-keo-lai-con:ky-thuat-tia-canh-keo-lai"
  "tan-dung-vuon-uom-keo-lai-hieu-qua-thang-6:tan-dung-vuon-uom-keo-lai-thang-6"
  "phong-tru-sau-benh-hai-keo-lai-dau-mua-mua:phong-tru-sau-benh-keo-lai-dau-mua-mua"
  "cham-soc-keo-lai-non-mua-he:cham-soc-vuon-keo-lai-non-mua-mua-thang-6"
  "kinh-nghiem-trong-keo-lai-giam-hom-thang-6:ky-thuat-trong-keo-lai-thang-6"
  "mat-do-trong-keo-lai:mat-do-trong-keo-lai-toi-uu"
  "kinh-nghiem-chon-dat-trong-keo-lai:cach-chon-dat-trong-keo-lai"
)

echo "== 1) Non-canonical slugs 301 to the correct canonical, canonical returns 200 =="
for pair in "${REDIRECT_PAIRS[@]}"; do
  from="${pair%%:*}"
  to="${pair##*:}"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BASE}/articles/${from}/")
  loc=$(curl -s -o /dev/null -w "%{redirect_url}" --max-time 10 "${BASE}/articles/${from}/")
  expected="${BASE}/articles/${to}/"
  if [ "$code" = "301" ] && [ "$loc" = "$expected" ]; then
    pass "$from -> 301 -> $to"
  else
    fail "$from -> got code=$code loc=$loc (expected 301 -> $expected)"
  fi
  canon_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$expected")
  if [ "$canon_code" = "200" ]; then
    pass "canonical $to -> 200"
  else
    fail "canonical $to -> got $canon_code (expected 200)"
  fi
done

echo
echo "== 2) lich-trong-keo-lai-theo-vung: static wins, Firestore dup retired (no live behavior change expected) =="
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BASE}/articles/lich-trong-keo-lai-theo-vung/")
[ "$code" = "200" ] && pass "lich-trong-keo-lai-theo-vung -> 200 (static)" || fail "lich-trong-keo-lai-theo-vung -> got $code"

echo
echo "== 3) 3 promoted Firestore articles (static removed) now serve 200 with real content =="
for slug in ki-thuat-trong-keo-lai-mua-kho kinh-nghiem-ban-go-keo-duoc-gia kinh-nghiem-trong-keo-lai-dong-nai; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BASE}/articles/${slug}/")
  [ "$code" = "200" ] && pass "$slug -> 200 (Firestore version now live)" || fail "$slug -> got $code"
done

echo
echo "== 4) Sitemap: no duplicates, no http://, no retired/redirected slugs listed =="
sitemap=$(curl -s --max-time 15 "${BASE}/sitemap.xml")
url_count=$(printf '%s' "$sitemap" | grep -oE '<loc>[^<]*</loc>' | wc -l | tr -d ' ')
uniq_count=$(printf '%s' "$sitemap" | grep -oE '<loc>[^<]*</loc>' | sort -u | wc -l | tr -d ' ')
[ "$url_count" = "$uniq_count" ] && pass "sitemap has no duplicate <loc> entries ($url_count URLs)" || fail "sitemap has duplicates: $url_count total vs $uniq_count unique"

http_count=$(printf '%s' "$sitemap" | grep -c '<loc>http://' || true)
[ "${http_count:-0}" = "0" ] && pass "no http:// URLs in sitemap" || fail "found $http_count http:// URLs in sitemap"

retired_hits=0
for pair in "${REDIRECT_PAIRS[@]}"; do
  from="${pair%%:*}"
  if printf '%s' "$sitemap" | grep -q "articles/${from}/"; then
    fail "sitemap still lists retired/redirected slug: $from"
    retired_hits=$((retired_hits+1))
  fi
done
[ "$retired_hits" = "0" ] && pass "no retired/redirected slugs present in sitemap"

no_slash_count=$(printf '%s' "$sitemap" | grep -oE '<loc>https://keolaigiamhom.vn/articles/[a-z0-9-]+</loc>' | wc -l | tr -d ' ')
[ "${no_slash_count:-0}" = "0" ] && pass "no non-trailing-slash article URLs in sitemap" || fail "$no_slash_count article URLs missing trailing slash"

echo
echo "== 5) Canonical tag self-references correctly on a sample of canonical pages =="
for slug in chi-phi-trong-1-ha-keo-lai bon-phan-cho-keo-lai chon-giong-keo-lai-phu-hop-vung-tay-nguyen ky-thuat-trong-keo-lai-thang-6; do
  html=$(curl -s --max-time 10 "${BASE}/articles/${slug}/")
  canon=$(printf '%s' "$html" | grep -oE '<link rel="canonical" href="[^"]*"' | head -1 | sed -E 's/.*href="([^"]*)"/\1/')
  expected="${BASE}/articles/${slug}/"
  [ "$canon" = "$expected" ] && pass "$slug canonical self-references correctly" || fail "$slug canonical=$canon (expected $expected)"
done

echo
if [ "$FAIL" = "0" ]; then
  echo "ALL CHECKS PASSED"
else
  echo "SOME CHECKS FAILED — see above"
fi
exit $FAIL
