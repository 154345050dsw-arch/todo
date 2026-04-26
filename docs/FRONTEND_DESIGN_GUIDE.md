# FlowDesk 前端设计规范

基于 Claude/Notion 设计语言，遵循简约、克制、温和、精致的原则。

## 一、色彩系统

### 主色调
```css
--app-primary: #5b7fc7;         /* 柔和蓝灰 - 主色 */
--app-primary-strong: #4a6fb5;  /* 主色加强 */
--app-primary-soft: #e8eef8;    /* 主色柔和背景 */
```

### 中性色（温暖灰调 stone 系列）
```css
--app-bg: #fafaf9;              /* 页面背景 */
--app-panel: #ffffff;           /* 卡片/面板背景 */
--app-panel-soft: #f5f5f4;      /* 柔和面板背景 */
--app-border: #e7e5e4;          /* 边框 */
--app-text: #1c1917;            /* 主文本 */
--app-muted: #78716c;           /* 次要文本 */
--app-subtle: #a8a29e;          /* 最弱文本 */
```

### 状态色（低饱和度）
```css
/* 待处理 - 灰调 */
todo: 'border-stone-200 bg-stone-50 text-stone-600'

/* 处理中 - 柔和紫 */
in_progress: 'border-indigo-200/60 bg-indigo-50/50 text-indigo-600'

/* 待确认 - 柔和蓝 */
confirming: 'border-blue-200/60 bg-blue-50/50 text-blue-600'

/* 已完成 - 柔和绿 */
done: 'border-emerald-200/60 bg-emerald-50/50 text-emerald-600'

/* 已超时 - 柔和红 */
overdue: 'border-red-200/60 bg-red-50/50 text-red-600'
```

### 暗色模式
```css
html.dark {
  --app-bg: #1a1816;
  --app-panel: #26241f;
  --app-panel-soft: #322f28;
  --app-border: rgba(250, 250, 249, 0.08);
  --app-text: #fafaf9;
  --app-muted: #a8a29e;
  --app-subtle: #78716c;
  --app-primary: #7c9dd6;
}
```

---

## 二、间距系统

```css
--space-1: 0.25rem;   /* 4px  - 微间距 */
--space-2: 0.5rem;    /* 8px  - 小间距 */
--space-3: 0.75rem;   /* 12px - 中间距 */
--space-4: 1rem;      /* 16px - 标准间距 */
--space-5: 1.5rem;    /* 24px - 大间距 */
--space-6: 2rem;      /* 32px - 区块间距 */
--space-7: 3rem;      /* 48px - 大区块间距 */
--space-8: 4rem;      /* 64px - 页面间距 */
```

**使用原则：**
- 内边距优先使用 `px-4 py-3`（卡片）、`px-5 py-4`（面板）、`px-6 py-5`（详情）
- 元素间距优先使用 `gap-2.5`（紧凑）、`gap-3`（标准）、`gap-4`（宽松）
- 区块间距使用 `space-y-5`（标准）、`space-y-6`（宽松）

---

## 三、阴影系统

```css
/* 边框阴影 */
--shadow-border: 0 0 0 1px rgba(0, 0, 0, 0.05);

/* 层级阴影 */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02);
--shadow-md: 0 2px 4px rgba(0, 0, 0, 0.04), 0 4px 6px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 4px 6px rgba(0, 0, 0, 0.04), 0 10px 15px rgba(0, 0, 0, 0.08);
--shadow-xl: 0 10px 10px rgba(0, 0, 0, 0.03), 0 20px 25px rgba(0, 0, 0, 0.08);

/* 焦点阴影 */
--shadow-focus: 0 0 0 3px rgba(91, 127, 199, 0.12);

/* 模态阴影 */
--shadow-modal: 0 25px 50px rgba(0, 0, 0, 0.25);
```

**使用场景：**
- `shadow-sm`：按钮悬停、选中状态
- `shadow-md`：卡片悬停
- `shadow-lg`：下拉菜单、抽屉
- `shadow-xl`：模态框
- `shadow-focus`：输入框焦点

---

## 四、圆角系统

```css
--radius-xs: 6px;    /* 微圆角 - 小按钮、徽章内部 */
--radius-sm: 8px;    /* 小圆角 - 输入框、小按钮 */
--radius-md: 10px;   /* 中圆角 - 卡片、面板 */
--radius-lg: 12px;   /* 大圆角 - 大卡片、下拉菜单 */
--radius-xl: 16px;   /* 特大圆角 - 模态框、大面板 */
--radius-2xl: 20px;  /* 超大圆角 - 特殊装饰 */
```

**使用原则：**
- Badge/Tag：`rounded-full`
- 按钮：`rounded-[10px]`（标准）、`rounded-xl`（大按钮）
- 输入框：`rounded-[10px]`
- 卡片：`rounded-[12px]`
- 模态框：`rounded-[16px]`

---

## 五、排版系统

### 字体大小
```css
--text-xs: 0.6875rem;    /* 11px - 最小文本（代码、标签） */
--text-sm: 0.8125rem;    /* 13px - 小文本（次要信息） */
--text-base: 0.9375rem;  /* 15px - 标准文本 */
--text-md: 1.0625rem;    /* 17px - 中标题 */
--text-lg: 1.1875rem;    /* 19px - 大标题 */
--text-xl: 1.375rem;     /* 22px - 特大标题 */
--text-2xl: 1.625rem;    /* 26px - 页面标题 */
```

### 行高
```css
--leading-tight: 1.25;    /* 紧凑 - 标题 */
--leading-snug: 1.375;    /* 较紧凑 - 小标题 */
--leading-normal: 1.5;    /* 标准 - 短文本 */
--leading-relaxed: 1.625; /* 宽松 - 长文本 */
```

### 字重
```css
--font-normal: 400;      /* 正文 */
--font-medium: 500;      /* 次标题 */
--font-semibold: 600;    /* 主标题 */
--font-bold: 700;        /* 特殊强调 */
```

### 字体家族
```css
/* 正文 - 无衬线 */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* 标题 - 衬线（详情页大标题） */
--font-serif: 'Source Serif 4', 'Noto Serif SC', Georgia, serif;
```

**使用原则：**
- 正文优先使用 `text-[15px]`
- 标签/时间戳使用 `text-[13px]` 或 `text-[11px]`
- 卡片标题使用 `text-[15px] font-semibold`
- 详情页标题使用 `text-[22px] font-semibold font-serif`
- 页面标题使用 `text-[26px] font-semibold`

---

## 六、组件规范

### 按钮

**主按钮**
```jsx
className="h-11 rounded-[10px] bg-[var(--app-primary)] px-5 text-[15px] font-medium text-white
  transition-all disabled:opacity-60 hover:bg-[var(--app-primary-strong)]"
```

**次要按钮**
```jsx
className="h-11 rounded-[10px] border border-[var(--app-border)] px-5 text-[15px] font-medium 
  text-[var(--app-muted)] transition-all hover:bg-[var(--app-panel-soft)]"
```

**图标按钮**
```jsx
className="grid size-10 place-items-center rounded-[10px] text-[var(--app-muted)] 
  transition-all hover:bg-[var(--app-panel-soft)]"
```

### 输入框

```jsx
className="h-10 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 
  text-[15px] outline-none focus:border-[var(--app-primary)]"
```

### 卡片

**任务卡片**
```jsx
className="rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4 
  text-left transition-all hover:border-[var(--app-primary)]/20 hover:shadow-[var(--shadow-md)]"
```

**信息卡片**
```jsx
className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] p-3"
```

### Badge/徽章

```jsx
className={`inline-flex rounded-full border px-2.5 py-1 text-[13px] font-medium ${toneClass}`}
```

### 模态框

```jsx
className="rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel)] 
  shadow-[0_24px_80px_rgba(0,0,0,0.28)] animate-modalPop"
```

---

## 七、布局规范

### 侧边栏
- 宽度：280px
- 内边距：20px（p-5）
- 导航项高度：44px（h-11）
- 导航项圆角：10px
- Logo 尺寸：40px（size-10）
- 导航图标：16px，strokeWidth={1.5}

### 顶部栏
- 高度：64px（h-16）
- 搜索框宽度：400px
- 搜索框高度：40px（h-10）
- 按钮高度：40px（h-10）

### 详情抽屉
- 宽度：540px（min-w-[480px] max-w-[540px]）
- 标题字号：22px，font-serif
- 内边距：32px（px-8）
- 操作按钮高度：44px（h-11）

### 看板视图
- 列宽度：290px - 330px
- 列间距：20px（gap-5）
- 卡片内边距：16px（p-4）
- 卡片圆角：12px

---

## 八、交互规范

### 悬停效果
```css
/* 卡片悬停 */
hover:border-[var(--app-primary)]/20
hover:shadow-[var(--shadow-md)]

/* 按钮悬停 */
hover:bg-[var(--app-primary-strong)]  /* 主按钮 */
hover:bg-[var(--app-panel-soft)]      /* 次要按钮 */

/* 链接悬停 */
hover:text-[var(--app-primary)]
```

### 过渡动画
```css
transition-all duration-200  /* 标准过渡 */
transition-transform duration-200  /* 变换过渡 */
transition-colors  /* 颜色过渡 */
```

### 焦点状态
```css
focus:border-[var(--app-primary)]
focus-visible:outline-2px-solid-[var(--app-primary)]
focus-visible:outline-offset-2px
```

---

## 九、图标规范

使用 Lucide React 图标库，统一规格：

- **小图标**：size={14} strokeWidth={1.5}
- **标准图标**：size={16} strokeWidth={1.5}
- **大图标**：size={18} strokeWidth={1.5}
- **特大图标**：size={24} strokeWidth={1.5}

---

## 十、暗色模式规范

### 阴影调整
```css
html.dark {
  --shadow-border: 0 0 0 1px rgba(250, 250, 249, 0.08);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.15);
  --shadow-md: 0 2px 4px rgba(0, 0, 0, 0.3), 0 4px 6px rgba(0, 0, 0, 0.2);
  --shadow-focus: 0 0 0 3px rgba(124, 157, 214, 0.24);
}
```

### 状态色适配
```css
/* 暗色模式状态色使用 opacity */
dark:border-indigo-500/15
dark:bg-indigo-500/8
dark:text-indigo-400
```

---

## 十一、开发规范

### 优先使用 CSS 变量
```jsx
// 推荐
className="bg-[var(--app-panel)] text-[var(--app-text)]"

// 避免
className="bg-white text-black"
```

### 优先使用 Tailwind 工具类
```jsx
// 推荐
className="px-4 py-3 rounded-[10px]"

// 避免
style={{ padding: '16px', borderRadius: '10px' }}
```

### 响应式优先桌面端
- 最小宽度：320px
- 断点：768px（平板）、1024px（桌面）

### 暗色模式同步
- 所有新组件必须同步适配暗色模式
- 使用 `html.dark` 类名切换
- 避免硬编码颜色

---

## 十二、代码示例

### 标准卡片组件
```jsx
function InfoCard({ title, children }) {
  return (
    <div className="rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] 
      p-4 transition-all duration-200 hover:border-[var(--app-primary)]/20 hover:shadow-[var(--shadow-md)]">
      <h3 className="text-[15px] font-semibold text-[var(--app-text)]">{title}</h3>
      <div className="mt-3 text-[15px] text-[var(--app-muted)]">{children}</div>
    </div>
  );
}
```

### 标准按钮组件
```jsx
function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-11 rounded-[10px] bg-[var(--app-primary)] px-5 text-[15px] font-medium 
        text-white transition-all duration-200 disabled:opacity-60 
        hover:bg-[var(--app-primary-strong)] active:scale-[0.98]"
    >
      {children}
    </button>
  );
}
```

---

## 参考资源

- Tailwind CSS 文档：https://tailwindcss.com
- Lucide 图标库：https://lucide.dev
- Claude 官网：https://claude.ai
- Notion 设计系统：https://www.notion.so