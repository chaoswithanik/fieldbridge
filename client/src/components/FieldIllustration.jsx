export default function FieldIllustration() {
  return (
    <div className="field-art">
      <div className="field-art-header"><span>মাঠ ও বাজারের মাঝে</span><span className="art-stamp">ফিল্ডব্রিজ</span></div>
      <svg viewBox="0 0 520 340" role="img" aria-labelledby="field-art-title">
        <title id="field-art-title">সবুজ ফসলের মাঠ ও বাজারকে যুক্ত করা একটি সেতুর প্রতীকী চিত্র</title>
        <defs>
          <pattern id="field-lines" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(-26)"><path d="M0 0V18" stroke="#83a590" strokeWidth="1" opacity=".42" /></pattern>
          <pattern id="crop-dots" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M10 16V8m0 5-4-4m4 1 4-4" stroke="#abcfb8" strokeWidth="1.2" fill="none" opacity=".6" /></pattern>
        </defs>
        <circle cx="408" cy="62" r="29" fill="#ffc166" />
        <circle cx="408" cy="62" r="43" fill="none" stroke="#83a590" opacity=".22" />
        <path d="M-20 168 164 65 317 153 128 262Z" fill="#2d4d3c" stroke="#83a590" strokeWidth="1" />
        <path d="M-20 168 164 65 317 153 128 262Z" fill="url(#field-lines)" />
        <path d="m-15 223 140 81 151-87-143-80Z" fill="#456553" stroke="#83a590" />
        <path d="m-15 223 140 81 151-87-143-80Z" fill="url(#crop-dots)" />
        <path d="m320 157 140-78 97 54v132l-86 51-157-91Z" fill="#2d4d3c" stroke="#83a590" />
        <path d="m320 157 140-78 97 54v132l-86 51-157-91Z" fill="url(#field-lines)" />
        <path d="m-20 338 183-10 180-114 197-51" fill="none" stroke="#83a590" strokeWidth="27" opacity=".18" />
        <path d="M-20 338c108-72 184-5 256-63s100-98 304-104" fill="none" stroke="#83a590" strokeWidth="15" opacity=".25" />
        <path d="m203 196 116 66 60-35-117-65Z" fill="#ffc166" stroke="#ffc166" strokeLinejoin="round" strokeWidth="3" />
        <path d="m203 196 116 66v18l-116-66Zm116 66 60-35v18l-60 35Z" fill="#825500" />
        <path d="m203 179 116 66 60-35m-176-14v-28m29 44v-28m29 45v-28m29 45v-28m29 45v-28m30 10v-28m30 10v-28" fill="none" stroke="#ffddb2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m204 240 1 20m145 9v19" stroke="#825500" strokeWidth="8" />
        <path d="M95 145v-29m0 15c-15 0-22-10-21-21 13-1 21 7 21 21Zm0-9c0-15 8-24 21-24 2 13-6 24-21 24Z" fill="#c7ebd4" stroke="#c7ebd4" strokeWidth="2" strokeLinejoin="round" />
        <path d="m417 168 29-17 29 17v35l-29 17-29-17Z" fill="#c7ebd4" />
        <path d="m417 168 29 16 29-16m-29 16v36m-14-60 28 16" fill="none" stroke="#456553" strokeWidth="1.5" />
        <path d="m129 135 51 29m212 41 20-12" stroke="#c7ebd4" strokeWidth="1.5" strokeDasharray="4 5" />
      </svg>
      <div className="field-art-footer"><span>কৃষকের ফলন</span><span className="art-connector" /><span>ক্রেতার চাহিদা</span></div>
    </div>
  );
}
