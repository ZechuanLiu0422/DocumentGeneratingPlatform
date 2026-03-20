import {
  AlignmentType,
  Document,
  LineRuleType,
  Packer,
  Paragraph,
  TextRun,
  type ISectionOptions,
} from 'docx';
import noticeTemplate from '@/templates/notice.json';
import letterTemplate from '@/templates/letter.json';
import requestTemplate from '@/templates/request.json';
import reportTemplate from '@/templates/report.json';

type DocType = 'notice' | 'letter' | 'request' | 'report';

type TemplateStyle = {
  font: string;
  size: number;
  bold?: boolean;
  line_spacing: number;
  line_spacing_rule: 'exactly' | 'multiple';
};

type TemplateSection = {
  field: string;
  style?: string;
  align?: 'center' | 'right' | 'justify' | 'left';
  indent?: number;
  right_space_chars?: number;
};

type TemplateDefinition = {
  sections: TemplateSection[];
  styles: Record<string, TemplateStyle>;
  page_setup: {
    top_margin: number;
    bottom_margin: number;
    left_margin: number;
    right_margin: number;
  };
};

type DocumentPayload = {
  title: string;
  recipient: string;
  content: string;
  issuer: string;
  date: string;
  attachments?: string[];
  contactName?: string;
  contactPhone?: string;
};

const templateMap: Record<DocType, TemplateDefinition> = {
  notice: noticeTemplate as TemplateDefinition,
  letter: letterTemplate as TemplateDefinition,
  request: requestTemplate as TemplateDefinition,
  report: reportTemplate as TemplateDefinition,
};

function cmToTwip(value: number) {
  return Math.round(value * 567);
}

function pointToTwip(value: number) {
  return Math.round(value * 20);
}

function formatChineseDate(date: string) {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) {
    return date;
  }

  return `${year}年${Number(month)}月${Number(day)}日`;
}

function detectHeadingLevel(line: string) {
  const trimmed = line.trim();
  if (/^[一二三四五六七八九十]+、/.test(trimmed)) {
    return 'heading1';
  }
  if (/^[（(][一二三四五六七八九十]+[）)]/.test(trimmed)) {
    return 'heading2';
  }
  return null;
}

function alignToDocx(align?: string) {
  switch (align) {
    case 'center':
      return AlignmentType.CENTER;
    case 'right':
      return AlignmentType.RIGHT;
    case 'left':
      return AlignmentType.LEFT;
    default:
      return AlignmentType.JUSTIFIED;
  }
}

function buildRun(text: string, style: TemplateStyle) {
  return new TextRun({
    text,
    font: style.font,
    size: style.size * 2,
    bold: style.bold || false,
  });
}

function buildParagraph(text: string, section: TemplateSection, style: TemplateStyle) {
  const firstLine = section.indent ? pointToTwip(section.indent * style.size) : undefined;
  const rightIndent = section.right_space_chars ? cmToTwip(section.right_space_chars * 0.56) : undefined;
  const exactLine = style.line_spacing_rule === 'exactly';

  return new Paragraph({
    alignment: alignToDocx(section.align),
    children: [buildRun(text, style)],
    indent: {
      firstLine,
      right: rightIndent,
    },
    spacing: {
      before: 0,
      after: 0,
      line: pointToTwip(style.line_spacing),
      lineRule: exactLine ? LineRuleType.EXACT : LineRuleType.AUTO,
    },
  });
}

function normalizeContent(field: string, value: string) {
  if (!value) {
    return value;
  }

  if (field === 'content') {
    return value
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .trim();
  }

  return value.replace(/\s+/g, ' ').trim();
}

function buildAttachmentParagraphs(attachments: string[], styles: Record<string, TemplateStyle>) {
  if (!attachments.length) {
    return [];
  }

  const style = styles.body;
  const paragraphs = [
    buildParagraph(`附件：1. ${attachments[0]}`, { field: 'attachment', style: 'body', indent: 2, align: 'justify' }, style),
  ];

  attachments.slice(1).forEach((attachment, index) => {
    paragraphs.push(
      new Paragraph({
        children: [buildRun(`${index + 2}. ${attachment}`, style)],
        indent: {
          left: pointToTwip(5 * style.size),
        },
        spacing: {
          before: 0,
          after: 0,
          line: pointToTwip(style.line_spacing),
          lineRule: LineRuleType.EXACT,
        },
      })
    );
  });

  paragraphs.push(buildParagraph(' ', { field: '_blank', style: 'body' }, style));
  paragraphs.push(buildParagraph(' ', { field: '_blank', style: 'body' }, style));
  return paragraphs;
}

function buildParagraphs(docType: DocType, data: DocumentPayload) {
  const template = templateMap[docType];
  const paragraphs: Paragraph[] = [];

  template.sections.forEach((section) => {
    if (section.field === 'attachment') {
      paragraphs.push(...buildAttachmentParagraphs(data.attachments || [], template.styles));
      return;
    }

    if (section.field.startsWith('_blank')) {
      paragraphs.push(buildParagraph(' ', section, template.styles.body));
      return;
    }

    let value = '';

    if (section.field === 'contact') {
      if (data.contactName && data.contactPhone) {
        value = `（联系人：${data.contactName}，电话：${data.contactPhone}）`;
      }
    } else if (section.field === 'date') {
      value = formatChineseDate(data.date);
    } else {
      value = (data as Record<string, string | string[] | undefined>)[section.field] as string;
    }

    value = normalizeContent(section.field, value || '');

    if (!value) {
      return;
    }

    if (section.field === 'recipient' && !/[：:]$/.test(value)) {
      value = `${value}：`;
    }

    if (section.field === 'content') {
      value
        .split('\n')
        .filter((line, index) => line.trim() || index === 0)
        .forEach((line) => {
          const headingLevel = detectHeadingLevel(line);
          const style = headingLevel ? template.styles[headingLevel] : template.styles[section.style || 'body'];
          paragraphs.push(buildParagraph(line, section, style));
        });
      return;
    }

    paragraphs.push(buildParagraph(value, section, template.styles[section.style || 'body']));
  });

  return paragraphs;
}

export async function generateDocumentBuffer(docType: DocType, data: DocumentPayload) {
  const template = templateMap[docType];
  const section: ISectionOptions = {
    properties: {
      page: {
        margin: {
          top: cmToTwip(template.page_setup.top_margin),
          bottom: cmToTwip(template.page_setup.bottom_margin),
          left: cmToTwip(template.page_setup.left_margin),
          right: cmToTwip(template.page_setup.right_margin),
        },
      },
    },
    children: buildParagraphs(docType, data),
  };

  const document = new Document({
    sections: [section],
  });

  return Packer.toBuffer(document);
}
