from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

ALLOWED_RICH_TEXT_TAGS = {"p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a", "img", "div"}
VOID_RICH_TEXT_TAGS = {"br", "img"}
BLOCKED_RICH_TEXT_TAGS = {"script", "style", "iframe", "object"}


class RichTextSanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.blocked_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in BLOCKED_RICH_TEXT_TAGS:
            self.blocked_depth += 1
            return
        if self.blocked_depth or tag not in ALLOWED_RICH_TEXT_TAGS:
            return
        safe_attrs = []
        attrs = dict(attrs)
        if tag == "a":
            href = attrs.get("href", "").strip()
            if href and urlparse(href).scheme in {"http", "https", "mailto"}:
                safe_attrs.append(("href", href))
                safe_attrs.append(("target", "_blank"))
                safe_attrs.append(("rel", "noopener noreferrer"))
        elif tag == "img":
            src = attrs.get("src", "").strip()
            if src.startswith("data:image/") and ";base64," in src[:40]:
                safe_attrs.append(("src", src))
                safe_attrs.append(("alt", attrs.get("alt", "")))
        attr_text = "".join(f' {name}="{escape(value, quote=True)}"' for name, value in safe_attrs)
        self.parts.append(f"<{tag}{attr_text}>")

    def handle_endtag(self, tag):
        if tag in BLOCKED_RICH_TEXT_TAGS and self.blocked_depth:
            self.blocked_depth -= 1
            return
        if self.blocked_depth:
            return
        if tag in ALLOWED_RICH_TEXT_TAGS and tag not in VOID_RICH_TEXT_TAGS:
            self.parts.append(f"</{tag}>")

    def handle_data(self, data):
        if not self.blocked_depth:
            self.parts.append(escape(data))

    def handle_entityref(self, name):
        if not self.blocked_depth:
            self.parts.append(f"&{name};")

    def handle_charref(self, name):
        if not self.blocked_depth:
            self.parts.append(f"&#{name};")


def sanitize_rich_text(value):
    value = value or ""
    if "<" not in value and ">" not in value:
        return escape(value).replace("\n", "<br>")
    parser = RichTextSanitizer()
    parser.feed(value)
    parser.close()
    return "".join(parser.parts)
