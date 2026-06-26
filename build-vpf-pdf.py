#!/usr/bin/env python3
import datetime
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                KeepTogether, HRFlowable)

NAVY=colors.HexColor("#0f172a"); SLATE=colors.HexColor("#334155"); MUTE=colors.HexColor("#64748b")
GREEN=colors.HexColor("#16a34a"); AMBER=colors.HexColor("#d97706"); RED=colors.HexColor("#dc2626")
LINE=colors.HexColor("#e2e8f0"); BG=colors.HexColor("#f8fafc")
SEV={"high":RED,"medium":AMBER,"low":MUTE}; SEV_LABEL={"high":"HIGH","medium":"MEDIUM","low":"LOW"}

styles=getSampleStyleSheet()
def S(name,**kw): return ParagraphStyle(name,parent=styles["Normal"],**kw)
h1=S("h1",fontName="Helvetica-Bold",fontSize=22,textColor=NAVY,leading=26,spaceAfter=2)
sub=S("sub",fontName="Helvetica",fontSize=10,textColor=MUTE,leading=14)
h2=S("h2",fontName="Helvetica-Bold",fontSize=14,textColor=NAVY,leading=18,spaceBefore=14,spaceAfter=6)
body=S("body",fontName="Helvetica",fontSize=9.5,textColor=SLATE,leading=13)
ftitle=S("ftitle",fontName="Helvetica-Bold",fontSize=10.5,textColor=NAVY,leading=13)
flabel=S("flabel",fontName="Helvetica-Bold",fontSize=7.5,textColor=colors.white,leading=9,alignment=TA_CENTER)
small=S("small",fontName="Helvetica",fontSize=8.5,textColor=SLATE,leading=12)
rem=S("rem",fontName="Helvetica-Oblique",fontSize=8.5,textColor=SLATE,leading=12)
def esc(t): return (t or "").replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")

gen=datetime.datetime.now().strftime("%B %d, %Y")
TARGET="velvetpureefoods.com"

# Lighthouse (mobile) from PSI
LH={"performance":67,"accessibility":94,"bestPractices":100,"seo":92}

FINDINGS=[
 ("high","Browser tab title is the builder's default",
  "The page &lt;title&gt; is \"Emergent | Fullstack App\" — the unchanged default from the Emergent app-builder. This is the clickable headline Google shows in search results and the title that appears when the link is shared anywhere.",
  "Set a branded, descriptive title, e.g. \"Velvet Puree — Consistent, chef-grade puree for restaurants & hotels.\""),
 ("high","Meta description is builder boilerplate",
  "The meta description reads \"A product of emergent.sh.\" Google frequently uses this as the snippet under the search result, so the listing currently markets the builder, not the product.",
  "Write a 140-160 character description of the product and who it's for."),
 ("high","Content is rendered entirely in the browser (no server-rendered HTML)",
  "The page's raw HTML is an almost-empty shell (~90 characters: a root div and an \"enable JavaScript\" notice). Every word, the contact form, and the Request-a-Sample button are drawn by JavaScript after load. Search engines, social link-preview scrapers, and assistive tools that don't run JavaScript see a blank page. This is also why automated scanners report \"no content\" or \"no contact method.\"",
  "Add server-side rendering (SSR) or static pre-rendering so the core content and contact details are present in the initial HTML."),
 ("high","Placeholder email shipped to production",
  "A demo address, chef@yourkitchen.com, is present in the live page. It is not a real Velvet Puree inbox, so any message sent to it is lost.",
  "Replace every placeholder with a real, monitored inbox on the brand domain."),
 ("medium","Builder watermark is visible to visitors",
  "A \"Made with Emergent\" badge is displayed in the bottom-right corner of the live site. It advertises the page-builder on a commercial brand page and reads as unfinished.",
  "Remove the builder attribution badge."),
 ("medium","Brand email / domain mismatch",
  "The website is velvetpureefoods.com, but the contact email uses a different domain: admin@velvetpuree.co. Mismatched domains reduce trust and deliverability, and the mailbox may not exist.",
  "Use a consistent address on the primary domain (e.g. hello@velvetpureefoods.com) and confirm it's live."),
 ("medium","No social-sharing preview (Open Graph) tags",
  "There are no Open Graph or Twitter Card tags. When the link is shared on iMessage, LinkedIn, Facebook, or Slack, it shows a plain or broken preview with no image or description.",
  "Add Open Graph and Twitter Card tags with a title, description, and a branded preview image."),
 ("medium","Mobile performance is mediocre (67 / 100)",
  "Google Lighthouse scores mobile performance 67/100, with a slow Speed Index and unoptimized image delivery. Most B2B buyers will open the link on a phone first.",
  "Compress and right-size images, serve modern formats (WebP/AVIF), reduce/defer JavaScript, and lazy-load below-the-fold media."),
 ("medium","Color-contrast failures (accessibility)",
  "Lighthouse flags text whose color does not meet the WCAG AA contrast minimum against its background (light text on the cream palette). Low-vision users and anyone in bright light can't read it.",
  "Increase contrast to at least 4.5:1 for body text by darkening text or deepening backgrounds."),
 ("medium","No Privacy Policy or Terms of Use",
  "The site collects email addresses through its Request-a-Sample form but publishes no privacy policy or terms. Collecting personal data without a privacy policy creates regulatory exposure (e.g. CCPA/GDPR).",
  "Add a Privacy Policy and Terms of Use, and name the operating company."),
 ("low","No favicon",
  "No site icon is declared, so the browser tab and bookmarks show a blank/default icon instead of the brand mark.",
  "Add a favicon built from the Velvet Puree logo."),
 ("low","Invalid robots.txt",
  "Lighthouse reports the robots.txt file is not valid, which can confuse search-engine crawlers about what they may index.",
  "Serve a valid robots.txt (and an XML sitemap)."),
 ("low","Run-together headline typography",
  "Several headings are missing spaces after punctuation or line breaks: \"Perfect puree.Zero inconsistency,\" \"a single ingredient,elevated,\" \"every professional kitchen knows.One quiet solution,\" and \"food platform —dressed in chef whites.\" It reads as a rendering bug.",
  "Fix the copy / line-break handling so words don't collide."),
 ("low","No web analytics detected",
  "No Google Analytics or tag-manager snippet was found, so there is no visibility into traffic, sources, or how many visitors actually request a sample.",
  "Add analytics and define the Request-a-Sample submission as a tracked conversion."),
 ("low","Missing HTTP security headers",
  "The response is missing a Content-Security-Policy, frame-protection, and permissions-policy headers (automated scan). These harden the site against common client-side attacks.",
  "Add standard security headers at the host/CDN level."),
]

bySev={"high":0,"medium":0,"low":0}
for f in FINDINGS: bySev[f[0]]+=1

story=[]
hdr=Table([[Paragraph('<font color="#7c3aed"><b>WebLaunchGuard</b></font>',S("brand",fontName="Helvetica-Bold",fontSize=13)),
            Paragraph(f'<para align="right"><font color="#64748b" size=8>Website Audit<br/>{gen}</font></para>',sub)]],
           colWidths=[3.5*inch,3.5*inch])
hdr.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0)]))
story.append(hdr); story.append(Spacer(1,4))
story.append(HRFlowable(width="100%",thickness=1,color=LINE,spaceAfter=14))
story.append(Paragraph("Website Audit",h1))
story.append(Paragraph(f'Target: <b>{TARGET}</b>',sub))
story.append(Spacer(1,12))
story.append(Paragraph(f'<b>{len(FINDINGS)} issues</b> found in a manual + automated review: '
                       f'<font color="{RED.hexval()}"><b>{bySev["high"]} high</b></font>, '
                       f'<font color="{AMBER.hexval()}"><b>{bySev["medium"]} medium</b></font>, '
                       f'<font color="{MUTE.hexval()}"><b>{bySev["low"]} low</b></font>. '
                       'The site is a strong product with strong copy; the issues below are the gap between "built" and "launch-ready."',body))

# Lighthouse
def lh_color(v): return GREEN if v>=90 else AMBER if v>=50 else RED
def lh_cell(label,v):
    t=Table([[Paragraph(f'<para align="center"><font size=18 color="{lh_color(v).hexval()}"><b>{v}</b></font></para>',body)],
             [Paragraph(f'<para align="center"><font size=7.5 color="#64748b">{label}</font></para>',body)]],colWidths=[1.45*inch])
    t.setStyle(TableStyle([("BOX",(0,0),(-1,-1),1,LINE),("TOPPADDING",(0,0),(0,0),9),("BOTTOMPADDING",(0,1),(0,1),9)]))
    return t
story.append(Paragraph("Google Lighthouse Scores (mobile)",h2))
story.append(Paragraph("Real Lighthouse audit via Google PageSpeed Insights. 90+ green, 50-89 needs work, under 50 poor.",small))
story.append(Spacer(1,6))
lr=Table([[lh_cell("Performance",LH["performance"]),lh_cell("Accessibility",LH["accessibility"]),
           lh_cell("Best Practices",LH["bestPractices"]),lh_cell("SEO",LH["seo"])]],colWidths=[1.55*inch]*4)
lr.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-2),8)]))
story.append(lr)
story.append(Paragraph('<font color="#64748b" size=8>Note: Lighthouse runs JavaScript, so it sees the rendered page and scores SEO 92. Real search crawlers and link scrapers often do not — see the client-side-rendering finding below.</font>',small))

story.append(Paragraph("Findings",h2))
rank={"high":0,"medium":1,"low":2}
for sev,title,desc,fix in sorted(FINDINGS,key=lambda f:rank[f[0]]):
    col=SEV[sev]
    badge=Table([[Paragraph(SEV_LABEL[sev],flabel)]],colWidths=[0.62*inch])
    badge.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),col),("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3)]))
    head=Table([[badge,Paragraph(esc(title),ftitle)]],colWidths=[0.72*inch,6.0*inch])
    head.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),0)]))
    block=[head,Spacer(1,3),Paragraph(desc,body),Spacer(1,2),
           Paragraph(f'<font color="#7c3aed"><b>Fix:</b></font> {fix}',rem),
           Spacer(1,4),HRFlowable(width="100%",thickness=0.6,color=LINE,spaceAfter=8)]
    story.append(KeepTogether(block))

story.append(Spacer(1,10))
story.append(HRFlowable(width="100%",thickness=1,color=LINE,spaceAfter=8))
disc=S("disc",fontName="Helvetica",fontSize=7.6,textColor=MUTE,leading=10.5)
disc_h=S("disc_h",fontName="Helvetica-Bold",fontSize=8,textColor=SLATE,leading=11,spaceAfter=2)
story.append(Paragraph("Disclaimer",disc_h))
story.append(Paragraph(
 'WebLaunchGuard is a <b>free, automated marketing tool</b> provided by CTF Designs. This report is informational only and '
 'does not constitute legal, security, or compliance advice. The checks are based on <b>publicly available, industry-standard '
 'web best practices</b> and a <b>passive review of publicly served content</b> — no login, intrusive, or active testing is '
 'performed. Findings are advisory and may be incomplete or inaccurate; they are a starting point for discussion, not a '
 'certified audit. WebLaunchGuard and CTF Designs accept <b>no responsibility or liability</b> for any use of or reliance on '
 'this report. Use is governed by the Terms of Use: '
 '<link href="https://weblaunchguard.com/terms"><font color="#7c3aed"><b>weblaunchguard.com/terms</b></font></link>.',disc))
story.append(Spacer(1,8))
story.append(Paragraph('Prepared by <font color="#7c3aed"><b>CTF Designs</b></font> via WebLaunchGuard &nbsp;·&nbsp; '
                       '<link href="https://ctfdesigns.com"><font color="#64748b">ctfdesigns.com</font></link>',sub))

def footer(canvas,doc):
    canvas.saveState(); canvas.setFont("Helvetica",7.5); canvas.setFillColor(MUTE)
    canvas.drawCentredString(LETTER[0]/2,0.45*inch,f"WebLaunchGuard · free marketing tool · Terms: weblaunchguard.com/terms · page {doc.page}")
    canvas.restoreState()

OUT="public/reports/velvetpureefoods.pdf"
doc=SimpleDocTemplate(OUT,pagesize=LETTER,leftMargin=0.7*inch,rightMargin=0.7*inch,topMargin=0.6*inch,bottomMargin=0.7*inch,
                      title="Website Audit - velvetpureefoods.com")
doc.build(story,onFirstPage=footer,onLaterPages=footer)
print("PDF written:",OUT)
