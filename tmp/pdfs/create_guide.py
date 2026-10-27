from pathlib import Path
import re, html
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Preformatted, KeepTogether, PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT
from pypdf import PdfReader

root=Path('E:/Programming/DelveDeep')
for name,file in [('Segoe','segoeui.ttf'),('SegoeBold','segoeuib.ttf'),('Code','consola.ttf')]:
    pdfmetrics.registerFont(TTFont(name,'C:/Windows/Fonts/'+file))
pdfmetrics.registerFontFamily('Segoe',normal='Segoe',bold='SegoeBold',italic='Segoe',boldItalic='SegoeBold')
navy=colors.HexColor('#172b3a'); gold=colors.HexColor('#a87b2c')
body=ParagraphStyle('Body',fontName='Segoe',fontSize=10.2,leading=14.3,textColor=navy,spaceAfter=8,allowWidows=0,allowOrphans=0)
heading=ParagraphStyle('Heading',parent=body,fontName='SegoeBold',fontSize=15,leading=19,spaceBefore=13,spaceAfter=8,keepWithNext=True)
title=ParagraphStyle('Title',parent=body,fontName='SegoeBold',fontSize=27,leading=32,spaceAfter=8)
sub=ParagraphStyle('Sub',parent=body,fontSize=10,textColor=gold,spaceAfter=18)
listing=ParagraphStyle('List',parent=body,leftIndent=16,firstLineIndent=0,bulletIndent=0,spaceAfter=7)
code=ParagraphStyle('Code',fontName='Code',fontSize=10,leading=15,backColor=colors.HexColor('#edf1f4'),borderPadding=10,spaceBefore=3,spaceAfter=15,textColor=navy)

def inline(text):
    text=text.replace('\u2011','-').replace('\u2013','-').replace('\u2014','-')
    text=html.escape(text)
    text=re.sub(r'`([^`]+)`',r'<font name="Code">\1</font>',text)
    text=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',text)
    text=text.replace('http://127.0.0.1:5186','<link href="http://127.0.0.1:5186" color="#7c5919">http://127.0.0.1:5186</link>')
    return text

story=[]
source=(root/'TUTORIAL_STUDIO_USER_GUIDE.md').read_text(encoding='utf-8-sig')
blocks=re.split(r'\n\s*\n',source.strip())
for block in blocks:
    if block.startswith('# '):
        story += [Paragraph('Tutorial Studio',title),Paragraph('USER GUIDE  /  DELVE DEEP  /  BATCH 1',sub)]
    elif block.startswith('## '):
        if block[3:] == 'Exit and lifecycle': story.append(PageBreak())
        story.append(Paragraph(inline(block[3:]),heading))
    elif block.startswith('```'):
        story.append(Preformatted('\n'.join(block.splitlines()[1:-1]),code))
    elif re.match(r'(\d+\. |\- )',block):
        for line in block.splitlines():
            m=re.match(r'(\d+)\. (.*)',line)
            if m: story.append(Paragraph(inline(m[2]),listing,bulletText=m[1]+'.'))
            elif line.startswith('- '): story.append(Paragraph(inline(line[2:]),listing,bulletText='\u2022'))
    else: story.append(Paragraph(inline(' '.join(block.splitlines())),body))

def decorate(canvas,doc):
    w,h=doc.pagesize
    canvas.setStrokeColor(gold);canvas.setLineWidth(.7);canvas.line(48,h-35,w-48,h-35)
    canvas.setFillColor(navy);canvas.setFont('Segoe',8)
    canvas.drawString(48,28,'DELVE DEEP  /  Tutorial Studio user guide')
    canvas.drawRightString(w-48,28,str(doc.page))
    canvas.setStrokeColor(colors.HexColor('#d6dce0'));canvas.line(48,43,w-48,43)

out=root/'output/pdf/TUTORIAL_STUDIO_USER_GUIDE.pdf'
doc=SimpleDocTemplate(str(out),pagesize=(612,792),leftMargin=48,rightMargin=48,topMargin=49,bottomMargin=57,title='Tutorial Studio User Guide',author='Delve Deep',subject='Tutorial Studio Batch 1 user guide')
doc.build(story,onFirstPage=decorate,onLaterPages=decorate)
r=PdfReader(out)
print('Created',out,'pages:',len(r.pages))
for i,p in enumerate(r.pages): print(i+1,len(p.extract_text()),(p.extract_text() or '')[:100].replace('\n',' | '))

