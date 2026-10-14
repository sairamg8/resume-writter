# Builds the PDFs in this folder (01 to 09 of the set; the ones kept are listed beside them): python3 make_pdfs.py OUTDIR (reportlab).
# 10-word-table-rows.pdf is 10-word-table-rows.html converted by LibreOffice (soffice --headless --convert-to pdf:writer_web_pdf_Export).
import sys, os
from reportlab.lib.pagesizes import A4, letter
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth
out = sys.argv[1]; os.makedirs(out, exist_ok=True)

JOBS = [
 ("Senior Software Engineer", "Acme Corp", "San Francisco, CA", "Jan 2020", "Present",
  ["Led a team of 6 engineers building a payments platform serving 2M users.",
   "Reduced API latency by 40% by introducing a caching layer and query tuning across the stack.",
   "Mentored four junior developers and ran weekly architecture reviews."]),
 ("Software Engineer", "Globex Inc", "Austin, TX", "Jun 2016", "Dec 2019",
  ["Built a React dashboard used by 300 internal analysts.",
   "Migrated a monolith to services, cutting deploy time from 2 hours to 10 minutes."]),
]
EDU = [("B.S. Computer Science", "University of Texas at Austin", "2012", "2016")]
SKILLS = [("Languages", "Python, JavaScript, TypeScript, Go, SQL"), ("Frameworks", "React, Node.js, Django, FastAPI"), ("Tools", "AWS, Docker, Kubernetes, Git, Terraform")]
SUMMARY = "Full-stack engineer with 8 years of experience building scalable web platforms and leading small teams."
CONTACT = ["jane.doe@example.com", "+1 (555) 123-4567", "San Francisco, CA", "linkedin.com/in/janedoe", "github.com/janedoe"]

def wrap(c, text, font, size, width):
    words = text.split(); lines=[]; cur=""
    for w in words:
        t = (cur+" "+w).strip()
        if stringWidth(t, font, size) <= width: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

class W:
    def __init__(s, name, size=A4):
        s.c = canvas.Canvas(os.path.join(out, name), pagesize=size); s.w, s.h = size; s.y = s.h-50
    def t(s, x, text, font="Helvetica", size=10, align="l", color=0):
        s.c.setFont(font, size); s.c.setFillGray(color)
        if align=="l": s.c.drawString(x, s.y, text)
        elif align=="r": s.c.drawRightString(x, s.y, text)
        else: s.c.drawCentredString(x, s.y, text)
    def nl(s, d=14):
        s.y -= d
        if s.y < 50: s.c.showPage(); s.y = s.h-50
    def rule(s, x1, x2): s.c.line(x1, s.y, x2, s.y)
    def save(s): s.c.save()

def classic(name, heads, datefmt, bullet="•", font="Helvetica", bold="Helvetica-Bold", size=letter, center=True):
    w = W(name, size); L, R = 54, w.w-54
    w.t(w.w/2 if center else L, "Jane Doe", bold, 22, "c" if center else "l"); w.nl(18)
    w.t(w.w/2 if center else L, "  |  ".join(CONTACT), font, 9, "c" if center else "l"); w.nl(22)
    def head(h):
        w.nl(6); w.t(L, h, bold, 12); w.nl(3); w.rule(L, R); w.nl(14)
    head(heads[0])
    for ln in wrap(w.c, SUMMARY, font, 10, R-L): w.t(L, ln, font, 10); w.nl()
    head(heads[1])
    for title, co, loc, a, b, bl in JOBS:
        w.t(L, co, bold, 11); w.t(R, loc, font, 10, "r"); w.nl()
        w.t(L, title, font+("-Oblique" if font=="Helvetica" else ""), 10); w.t(R, datefmt(a,b), font, 10, "r"); w.nl(15)
        for b_ in bl:
            ls = wrap(w.c, b_, font, 10, R-L-18)
            w.t(L+8, bullet, font, 10)
            for i, ln in enumerate(ls): w.t(L+18, ln, font, 10); w.nl(13)
        w.nl(5)
    head(heads[2])
    for deg, sc, a, b in EDU:
        w.t(L, sc, bold, 11); w.t(R, "Austin, TX", font, 10, "r"); w.nl()
        w.t(L, deg, font, 10); w.t(R, f"{a} – {b}", font, 10, "r"); w.nl(15)
    head(heads[3])
    for k, v in SKILLS:
        w.t(L, k+":", bold, 10); w.t(L+90, v, font, 10); w.nl()
    w.save()

fmt1 = lambda a,b: f"{a} – {b}"
fmt2 = lambda a,b: f"{a} - {b}"
def num(m):
    mo = {"Jan":"01","Jun":"06","Dec":"12"}
    return f"{mo[m[:3]]}/{m[-4:]}" if m!="Present" else m
fmt3 = lambda a,b: f"{num(a)} - {num(b)}"
fmt4 = lambda a,b: f"{a[-4:]}–{b[-4:] if b!='Present' else 'Present'}"

classic("01-classic-word.pdf", ["Professional Summary","Work Experience","Education","Skills"], fmt1)
classic("02-caps-headings.pdf", ["SUMMARY","EXPERIENCE","EDUCATION","TECHNICAL SKILLS"], fmt2, size=A4)
classic("03-numeric-dates.pdf", ["Profile","Employment History","Academic Background","Core Competencies"], fmt3, bullet="-", font="Times-Roman", bold="Times-Bold")
classic("04-year-only.pdf", ["Objective","Professional Experience","Education","Technical Skills"], fmt4, bullet="▪" if False else "*", center=False)

# LaTeX 'Jake' style: left bold company + right dates, italic role + right location
def jake(name):
    w = W(name, letter); L,R=45, w.w-45; f="Times-Roman"; b="Times-Bold"; i="Times-Italic"
    w.t(w.w/2, "Jane Doe", b, 24, "c"); w.nl(16)
    w.t(w.w/2, "+1 (555) 123-4567 $|$ jane.doe@example.com | linkedin.com/in/janedoe | github.com/janedoe".replace("$|$","|"), f, 9.5, "c"); w.nl(24)
    def head(h):
        w.t(L, h.upper() if False else h, "Times-Roman", 13); w.nl(3); w.rule(L,R); w.nl(14)
    head("Education")
    w.t(L,"University of Texas at Austin",b,10.5); w.t(R,"Austin, TX",f,10.5,"r"); w.nl(12)
    w.t(L,"Bachelor of Science in Computer Science",i,9.5); w.t(R,"Aug. 2012 – May 2016",i,9.5,"r"); w.nl(20)
    head("Experience")
    for title, co, loc, a, b_, bl in JOBS:
        w.t(L,title,b,10.5); w.t(R,f"{a[:3]}. {a[-4:]} – {b_ if b_=='Present' else b_[:3]+'. '+b_[-4:]}".replace("Jan.","Jan."),f,10.5,"r"); w.nl(12)
        w.t(L,co,i,9.5); w.t(R,loc,i,9.5,"r"); w.nl(13)
        for x in bl:
            ls=wrap(w.c,x,f,9.5,R-L-20); w.t(L+12,"•",f,9.5)
            for ln in ls: w.t(L+22,ln,f,9.5); w.nl(12)
        w.nl(6)
    head("Technical Skills")
    for k,v in SKILLS:
        w.t(L+10,k+":",b,9.5); w.t(L+10+stringWidth(k+": ",b,9.5)+2,v,f,9.5); w.nl(13)
    w.save()
jake("05-latex-jake.pdf")

# Two-column: left sidebar (contact, skills, education) right main
def sidebar(name, left=True):
    w = W(name, A4); SW=170
    c=w.c
    c.setFillGray(0.92); c.rect(0 if left else w.w-SW,0,SW,w.h,fill=1,stroke=0)
    lx = 20 if left else w.w-SW+20; mx = SW+25 if left else 40; mr = w.w-30 if left else w.w-SW-20
    y0 = w.h-60
    w.y=y0; w.t(mx,"Jane Doe","Helvetica-Bold",26); w.nl(18); w.t(mx,"Senior Software Engineer","Helvetica",12,color=.3); w.nl(30)
    def mhead(h): w.t(mx,h.upper(),"Helvetica-Bold",11); w.nl(4); w.rule(mx,mr); w.nl(15)
    mhead("Profile")
    for ln in wrap(c,SUMMARY,"Helvetica",9.5,mr-mx): w.t(mx,ln,"Helvetica",9.5); w.nl(13)
    w.nl(10); mhead("Experience")
    for title,co,loc,a,b,bl in JOBS:
        w.t(mx,title,"Helvetica-Bold",10.5); w.nl(13)
        w.t(mx,f"{co}  |  {a} – {b}","Helvetica-Oblique",9.5); w.nl(14)
        for x in bl:
            ls=wrap(c,x,"Helvetica",9.5,mr-mx-14); w.t(mx+2,"•","Helvetica",9.5)
            for ln in ls: w.t(mx+14,ln,"Helvetica",9.5); w.nl(12.5)
        w.nl(8)
    w.y=y0
    def lhead(h): w.t(lx,h.upper(),"Helvetica-Bold",10.5); w.nl(15)
    lhead("Contact")
    for x in CONTACT: w.t(lx,x,"Helvetica",8.5); w.nl(12)
    w.nl(14); lhead("Skills")
    for k,v in SKILLS:
        w.t(lx,k,"Helvetica-Bold",9); w.nl(11)
        for ln in wrap(c,v,"Helvetica",9,SW-35): w.t(lx,ln,"Helvetica",9); w.nl(11)
        w.nl(4)
    w.nl(10); lhead("Education")
    for deg,sc,a,b in EDU:
        w.t(lx,deg,"Helvetica-Bold",9); w.nl(11)
        for ln in wrap(c,sc,"Helvetica",9,SW-35): w.t(lx,ln,"Helvetica",9); w.nl(11)
        w.t(lx,f"{a} – {b}","Helvetica",9)
    w.save()
sidebar("06-sidebar-left.pdf"); sidebar("07-sidebar-right.pdf", left=False)

# Date column on the left (Europass / timeline style)
def timeline(name):
    w = W(name, A4); L=50; D=160; R=w.w-50
    w.t(L,"JANE DOE","Helvetica-Bold",24); w.nl(16)
    w.t(L,"jane.doe@example.com · +1 (555) 123-4567 · San Francisco, CA · linkedin.com/in/janedoe","Helvetica",9); w.nl(24)
    def head(h): w.t(L,h,"Helvetica-Bold",12); w.nl(4); w.rule(L,R); w.nl(15)
    head("Experience")
    for title,co,loc,a,b,bl in JOBS:
        w.t(L,f"{a} – {b}","Helvetica",9.5); w.t(D,title,"Helvetica-Bold",10.5); w.nl(13)
        w.t(D,f"{co}, {loc}","Helvetica-Oblique",9.5); w.nl(13)
        for x in bl:
            ls=wrap(w.c,x,"Helvetica",9.5,R-D-12); w.t(D,"•","Helvetica",9.5)
            for ln in ls: w.t(D+12,ln,"Helvetica",9.5); w.nl(12.5)
        w.nl(8)
    head("Education")
    for deg,sc,a,b in EDU:
        w.t(L,f"{a} – {b}","Helvetica",9.5); w.t(D,deg,"Helvetica-Bold",10.5); w.nl(13); w.t(D,sc,"Helvetica",9.5); w.nl(20)
    head("Skills")
    for k,v in SKILLS: w.t(L,k,"Helvetica-Bold",9.5); w.t(D,v,"Helvetica",9.5); w.nl(13)
    w.save()
timeline("08-timeline-datecol.pdf")

# Extra sections: projects, certifications, languages, awards; multi-page
def extra(name):
    w = W(name, letter); L,R=54,w.w-54
    w.t(L,"Jane Doe","Helvetica-Bold",22); w.nl(16)
    w.t(L,"Software Engineer","Helvetica",12); w.nl(14)
    w.t(L,"jane.doe@example.com • (555) 123-4567 • janedoe.dev","Helvetica",9.5); w.nl(22)
    def head(h): w.t(L,h.upper(),"Helvetica-Bold",11); w.nl(3); w.rule(L,R); w.nl(14)
    head("Summary")
    for ln in wrap(w.c,SUMMARY,"Helvetica",10,R-L): w.t(L,ln,"Helvetica",10); w.nl()
    w.nl(6); head("Experience")
    for title,co,loc,a,b,bl in JOBS*2:
        w.t(L,f"{title}, {co}","Helvetica-Bold",10.5); w.t(R,f"{a} – {b}","Helvetica",10,"r"); w.nl(14)
        for x in bl:
            ls=wrap(w.c,x,"Helvetica",10,R-L-18); w.t(L+8,"•","Helvetica",10)
            for ln in ls: w.t(L+18,ln,"Helvetica",10); w.nl(13)
        w.nl(6)
    head("Projects")
    w.t(L,"ResumeKit","Helvetica-Bold",10.5); w.t(R,"2023","Helvetica",10,"r"); w.nl(13)
    for ln in wrap(w.c,"Open-source résumé builder with live preview and PDF export. github.com/janedoe/resumekit","Helvetica",10,R-L): w.t(L,ln,"Helvetica",10); w.nl()
    w.nl(8); head("Certifications")
    w.t(L,"AWS Certified Solutions Architect – Associate","Helvetica",10); w.t(R,"2022","Helvetica",10,"r"); w.nl(16)
    head("Languages")
    w.t(L,"English (Native), Spanish (Professional), German (Basic)","Helvetica",10); w.nl(16)
    head("Awards")
    w.t(L,"Engineer of the Year, Acme Corp","Helvetica",10); w.t(R,"2021","Helvetica",10,"r"); w.nl(16)
    head("Education")
    for deg,sc,a,b in EDU:
        w.t(L,f"{deg}, {sc}","Helvetica-Bold",10.5); w.t(R,f"{a} – {b}","Helvetica",10,"r"); w.nl(14)
    w.save()
extra("09-extra-sections-multipage.pdf")
