#!/usr/bin/env python3
import json, datetime
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                KeepTogether, HRFlowable)

d = json.load(open("/tmp/wlg-scan.json"))

NAVY  = colors.HexColor("#0f172a")
SLATE = colors.HexColor("#334155")
MUTE  = colors.HexColor("#64748b")
GREEN = colors.HexColor("#16a34a")
AMBER = colors.HexColor("#d97706")
RED   = colors.HexColor("#dc2626")
LINE  = colors.HexColor("#e2e8f0")
BG    = colors.HexColor("#f8fafc")

SEV = {"high": RED, "medium": AMBER, "low": MUTE}
SEV_LABEL = {"high": "HIGH", "medium": "MEDIUM", "low": "LOW"}

styles = getSampleStyleSheet()
def S(name, **kw):
    return ParagraphStyle(name, parent=styles["Normal"], **kw)

h1   = S("h1", fontName="Helvetica-Bold", fontSize=22, textColor=NAVY, leading=26, spaceAfter=2)
sub  = S("sub", fontName="Helvetica", fontSize=10, textColor=MUTE, leading=14)
h2   = S("h2", fontName="Helvetica-Bold", fontSize=14, textColor=NAVY, leading=18, spaceBefore=14, spaceAfter=6)
body = S("body", fontName="Helvetica", fontSize=9.5, textColor=SLATE, leading=13)
ftitle = S("ftitle", fontName="Helvetica-Bold", fontSize=10.5, textColor=NAVY, leading=13)
flabel = S("flabel", fontName="Helvetica-Bold", fontSize=7.5, textColor=colors.white, leading=9, alignment=TA_CENTER)
small = S("small", fontName="Helvetica", fontSize=8.5, textColor=SLATE, leading=12)
rem  = S("rem", fontName="Helvetica-Oblique", fontSize=8.5, textColor=SLATE, leading=12)

def esc(t):
    return (t or "").replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")

gen = datetime.datetime.now().strftime("%B %d, %Y")
# Score is a HEALTH score: higher = better (100 - penalties). Bands match the
# live WebLaunchGuard UI: >=80 looking good, >=50 needs work, else poor.
score = d["riskScore"]
band = ("Looking good", GREEN) if score >= 80 else ("Needs work", AMBER) if score >= 50 else ("Needs urgent work", RED)

bySev = {"high":0,"medium":0,"low":0}
for f in d["findings"]: bySev[f["severity"]] = bySev.get(f["severity"],0)+1

story = []

# ---- Header band
hdr = Table([[Paragraph('<font color="#7c3aed"><b>WebLaunchGuard</b></font>', S("brand", fontName="Helvetica-Bold", fontSize=13)),
              Paragraph(f'<para align="right"><font color="#64748b" size=8>Website Readiness Report<br/>{gen}</font></para>', sub)]],
             colWidths=[3.5*inch, 3.5*inch])
hdr.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
story.append(hdr)
story.append(Spacer(1,4))
story.append(HRFlowable(width="100%", thickness=1, color=LINE, spaceAfter=14))

# ---- Title
story.append(Paragraph("Website Readiness Report", h1))
story.append(Paragraph(f'Target: <b>{esc(d["finalUrl"])}</b>', sub))
story.append(Spacer(1,14))

# ---- Score + severity summary cards
bignum = S("bignum", fontName="Helvetica-Bold", fontSize=32, leading=36, alignment=TA_CENTER, textColor=band[1])
score_cell = Table([
    [Paragraph(f'{score}', bignum)],
    [Paragraph(f'<para align="center"><font size=8 color="#64748b">RISK SCORE / 100</font></para>', body)],
    [Paragraph(f'<para align="center"><font size=9 color="{band[1].hexval()}"><b>{band[0]}</b></font></para>', body)],
], colWidths=[2.0*inch])
score_cell.setStyle(TableStyle([("BOX",(0,0),(-1,-1),1,LINE),("BACKGROUND",(0,0),(-1,-1),BG),
    ("TOPPADDING",(0,0),(0,0),12),("BOTTOMPADDING",(0,2),(0,2),12),("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6)]))

def sevbox(n,label,col):
    t = Table([[Paragraph(f'<para align="center"><font size=20 color="{col.hexval()}"><b>{n}</b></font></para>',body)],
               [Paragraph(f'<para align="center"><font size=8 color="#64748b">{label}</font></para>',body)]], colWidths=[1.45*inch])
    t.setStyle(TableStyle([("BOX",(0,0),(-1,-1),1,LINE),("TOPPADDING",(0,0),(0,0),12),("BOTTOMPADDING",(0,1),(0,1),12)]))
    return t

sev_row = Table([[sevbox(bySev["high"],"HIGH",RED), sevbox(bySev["medium"],"MEDIUM",AMBER),
                  sevbox(bySev["low"],"LOW",MUTE)]], colWidths=[1.55*inch]*3)
sev_row.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(0,1),8)]))

top = Table([[score_cell, sev_row]], colWidths=[2.15*inch, 4.85*inch])
top.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),0)]))
story.append(top)
story.append(Spacer(1,6))
story.append(Paragraph(f'{d["totalFindings"]} issues detected across security headers, transport, privacy, accessibility, SEO and best practices. '
                       f'A higher score is better (100 = clean). SOC 2 readiness: {d["soc2"]["passed"]} of {d["soc2"]["total"]} controls passing.', small))

# ---- Findings
story.append(Paragraph("Findings", h2))
rank = {"high":0,"medium":1,"low":2}
findings = sorted(d["findings"], key=lambda f: rank.get(f["severity"],3))
for f in findings:
    col = SEV[f["severity"]]
    badge = Table([[Paragraph(SEV_LABEL[f["severity"]], flabel)]], colWidths=[0.62*inch])
    badge.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),col),("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("ROUNDEDCORNERS",[3,3,3,3])]))
    head = Table([[badge, Paragraph(esc(f["title"]), ftitle)]], colWidths=[0.72*inch, 6.0*inch])
    head.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),0)]))
    block = [head, Spacer(1,3), Paragraph(esc(f.get("description","")), body)]
    if f.get("evidence"):
        block += [Spacer(1,2), Paragraph(f'<font color="#64748b">Evidence:</font> {esc(f["evidence"])}', small)]
    if f.get("remediation"):
        block += [Spacer(1,2), Paragraph(f'<font color="#7c3aed"><b>Fix:</b></font> {esc(f["remediation"])}', rem)]
    block += [Spacer(1,4), HRFlowable(width="100%", thickness=0.6, color=LINE, spaceAfter=8)]
    story.append(KeepTogether(block))

# ---- SOC2
story.append(Paragraph(f'SOC 2 Readiness ({d["soc2"]["passed"]}/{d["soc2"]["total"]} passing)', h2))
rows = [[Paragraph("<b>Control</b>",small), Paragraph("<b>Check</b>",small), Paragraph("<b>Status</b>",small)]]
for it in d["soc2"]["items"]:
    st = "PASS" if it["passing"] else "REVIEW"
    stc = GREEN if it["passing"] else AMBER
    rows.append([Paragraph(esc(it["control"]),small),
                 Paragraph(esc(it["title"]),small),
                 Paragraph(f'<font color="{stc.hexval()}"><b>{st}</b></font>',small)])
tbl = Table(rows, colWidths=[0.9*inch, 4.6*inch, 1.0*inch])
tbl.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(-1,0),NAVY),("TEXTCOLOR",(0,0),(-1,0),colors.white),
    ("LINEBELOW",(0,0),(-1,-1),0.5,LINE),("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
    ("LEFTPADDING",(0,0),(-1,-1),7),
    ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white, BG])]))
for i,c in enumerate(rows[0]):
    pass
tbl.setStyle(TableStyle([("TEXTCOLOR",(0,0),(-1,0),colors.white)], ))
story.append(tbl)

story.append(Spacer(1,16))
story.append(HRFlowable(width="100%", thickness=1, color=LINE, spaceAfter=8))

disc = S("disc", fontName="Helvetica", fontSize=7.6, textColor=MUTE, leading=10.5)
disc_h = S("disc_h", fontName="Helvetica-Bold", fontSize=8, textColor=SLATE, leading=11, spaceAfter=2)
story.append(Paragraph("Disclaimer", disc_h))
story.append(Paragraph(
    'WebLaunchGuard is a <b>free, automated marketing tool</b> provided by CTF Designs. This report is '
    'informational only and does not constitute legal, security, or compliance advice. The checks are based '
    'on <b>publicly available, industry-standard web best practices</b> (security headers, transport, privacy, '
    'accessibility, SEO, and SOC 2 guidance) and perform only a <b>passive review of publicly served content</b> '
    '— no login, intrusive, or active testing is performed. Findings are advisory and may be incomplete or '
    'inaccurate; results are a starting point for discussion, not a certified audit. WebLaunchGuard and CTF '
    'Designs accept <b>no responsibility or liability</b> for any use of, interpretation of, or reliance on this '
    'report by any party. Use of this report is governed by the Terms of Use: '
    '<font color="#7c3aed"><b>weblaunchguard.com/terms</b></font> '
    '(<link href="https://weblaunchguard.com/terms"><font color="#7c3aed">https://weblaunchguard.com/terms</font></link>).',
    disc))
story.append(Spacer(1,8))
story.append(Paragraph('Generated by <font color="#7c3aed"><b>WebLaunchGuard</b></font> &nbsp;·&nbsp; '
                       '<link href="https://weblaunchguard.com"><font color="#64748b">weblaunchguard.com</font></link>', sub))

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTE)
    canvas.drawCentredString(LETTER[0]/2, 0.45*inch, f"WebLaunchGuard · free marketing tool · Terms: weblaunchguard.com/terms · page {doc.page}")
    canvas.restoreState()

doc = SimpleDocTemplate("/Users/roman/thetemeculalawfirm-wlg-report.pdf", pagesize=LETTER,
    leftMargin=0.7*inch, rightMargin=0.7*inch, topMargin=0.6*inch, bottomMargin=0.7*inch,
    title="WebLaunchGuard Report - thetemeculalawfirm.com")
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("PDF written: /Users/roman/thetemeculalawfirm-wlg-report.pdf")
