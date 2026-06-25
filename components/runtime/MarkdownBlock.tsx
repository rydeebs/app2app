import ReactMarkdown from "react-markdown";
import { Card, CardTitle } from "./Card";
import type { AppComponent } from "@/lib/appSpec";

type Props = Extract<AppComponent, { type: "markdown" }>;

export function MarkdownBlock({ title, content }: Props) {
  return (
    <Card>
      {title ? <CardTitle>{title}</CardTitle> : null}
      <div className="prose-sm max-w-none space-y-2 text-sm leading-relaxed text-foreground [&_a]:text-primary [&_h1]:mt-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-2 [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </Card>
  );
}
