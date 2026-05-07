'use client'

import ReactMarkdown from 'react-markdown'

export default function BlogMarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <div className="max-h-[480px] overflow-auto rounded-lg border border-bt-border-strong bg-white p-4 text-sm leading-relaxed text-bt-body shadow-inner">
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h2 className="mt-4 border-b border-bt-border-strong pb-1 text-base font-semibold text-bt-title first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => <h3 className="mt-3 text-sm font-semibold text-bt-title">{children}</h3>,
          p: ({ children }) => <p className="mt-2 whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          a: ({ href, children }) => (
            <a href={href} className="text-bt-brand-blue underline hover:opacity-90" target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          hr: () => <hr className="my-4 border-bt-border-strong" />,
          strong: ({ children }) => <strong className="font-semibold text-bt-title">{children}</strong>,
        }}
      >
        {markdown || '*(내용 없음)*'}
      </ReactMarkdown>
    </div>
  )
}
