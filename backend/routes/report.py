# backend/routes/report.py
from flask import Blueprint, request, send_file
from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem, Table, TableStyle
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
import io

report_bp = Blueprint("report", __name__)

@report_bp.route("/", methods=["POST"])
def generate_report():
    data = request.json or {}

    # Extract fields
    image_name = data.get("image_name", "uploaded_image")
    predicted_class = data.get("predicted_class", "Unknown")
    confidence = data.get("confidence", "N/A")
    description = data.get("description", "No description available.")
    treatment = data.get("treatment", "No treatment available.")
    references = data.get("references", [])

    # PDF Buffer
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=0.8*inch,
        bottomMargin=0.8*inch,
        leftMargin=0.8*inch,
        rightMargin=0.8*inch
    )

    # Styles
    styles = getSampleStyleSheet()
    # Avoid redefining built-in names
    if "SectionHeading" not in styles:
        styles.add(ParagraphStyle(
            name="SectionHeading",
            fontSize=13,
            leading=18,
            spaceAfter=8,
            textColor=colors.HexColor("#0d47a1"),
            fontName="Helvetica-Bold"
        ))
    if "CustomBody" not in styles:
        styles.add(ParagraphStyle(
            name="CustomBody",
            fontSize=11,
            leading=16,
            spaceAfter=6,
            fontName="Helvetica"
        ))
    if "Disclaimer" not in styles:
        styles.add(ParagraphStyle(
            name="Disclaimer",
            fontSize=9,
            leading=12,
            textColor=colors.red,
            fontName="Helvetica-Oblique"
        ))

    story = []

    # Title
    story.append(Paragraph("DermAI — Skin Disease Report", styles["Title"]))
    story.append(Spacer(1, 0.3*inch))

    # Patient/Case Table (bold labels using Paragraph)
    bold_style = ParagraphStyle(name="BoldLabel", fontName="Helvetica-Bold", fontSize=11, leading=14)
    normal_style = styles["CustomBody"]

    table_data = [
        [Paragraph("Image", bold_style), Paragraph(image_name, normal_style)],
        [Paragraph("Disease Prediction", bold_style), Paragraph(predicted_class, normal_style)],
        [Paragraph("Confidence", bold_style), Paragraph(f"{confidence}%", normal_style)]
    ]
    table = Table(table_data, colWidths=[150, 300])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e3f2fd")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.black),
    ]))
    story.append(table)
    story.append(Spacer(1, 0.3*inch))

    # Description
    story.append(Paragraph("Description", styles["SectionHeading"]))
    story.append(Paragraph(description, normal_style))
    story.append(Spacer(1, 0.2*inch))

    # Treatment
    story.append(Paragraph("Recommended Treatment", styles["SectionHeading"]))
    story.append(Paragraph(treatment, normal_style))
    story.append(Spacer(1, 0.2*inch))

    # References
    story.append(Paragraph("References", styles["SectionHeading"]))
    if references and isinstance(references, list):
        ref_items = []
        for ref in references:
            ref_items.append(ListItem(Paragraph(f'<link href="{ref}">{ref}</link>', normal_style)))
        story.append(ListFlowable(ref_items, bulletType="bullet"))
    else:
        story.append(Paragraph("No references available.", normal_style))
    story.append(Spacer(1, 0.3*inch))

    # Disclaimer
    story.append(Paragraph(
        "⚠ Disclaimer: This is an AI-generated report and should not be considered medical advice. "
        "Always consult a healthcare professional.",
        styles["Disclaimer"]
    ))

    # Build PDF
    doc.build(story)
    buffer.seek(0)

    return send_file(
        buffer,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"DermAI_Report.pdf"
    )
