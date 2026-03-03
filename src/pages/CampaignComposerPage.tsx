import {
  startTransition,
  useDeferredValue,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from 'react';
import { getImageDimensions, readFileAsDataURL } from '../utils/fileUtils';

type DirectionTone = 'smart' | 'premium' | 'energetic';
type LayoutMode = 'spotlight' | 'split' | 'mosaic';

interface CampaignBrief {
  headline: string;
  audience: string;
  tone: DirectionTone;
  directionNote: string;
}

interface ProductDraft {
  id: string;
  imageUrl: string;
  imageName: string;
  imageWidth: number;
  imageHeight: number;
  catchCopy: string;
  listPrice: string;
  salePrice: string;
  makerName: string;
  campaignStart: string;
  campaignEnd: string;
}

interface StylePack {
  id: string;
  label: string;
  background: string;
  surface: string;
  accent: string;
  accentSoft: string;
  text: string;
  muted: string;
  ring: string;
  displayFont: string;
  bodyFont: string;
  badgeFont: string;
}

interface AiDesignDraft {
  stylePack: StylePack;
  renderProducts: ProductDraft[];
  heroProductId: string | null;
  toneLabel: string;
  layoutMode: LayoutMode;
  layoutLabel: string;
  artDirection: string;
  headline: string;
  subline: string;
  badgeText: string;
  averageDiscountRate: number;
  maxDiscountRate: number;
  insightLines: string[];
  promptLine: string;
}

const STYLE_PACKS: StylePack[] = [
  {
    id: 'sunrise-editorial',
    label: 'Sunrise Editorial',
    background:
      'linear-gradient(145deg, rgba(255, 247, 238, 0.96) 0%, rgba(252, 228, 214, 0.94) 42%, rgba(241, 246, 255, 0.92) 100%)',
    surface: 'rgba(255, 255, 255, 0.9)',
    accent: '#df5f39',
    accentSoft: 'rgba(223, 95, 57, 0.18)',
    text: '#1f2437',
    muted: '#5f667b',
    ring: 'rgba(223, 95, 57, 0.28)',
    displayFont: '"Kaisei Tokumin", serif',
    bodyFont: '"Zen Kaku Gothic New", sans-serif',
    badgeFont: '"Mochiy Pop One", sans-serif',
  },
  {
    id: 'mint-studio',
    label: 'Mint Studio',
    background:
      'linear-gradient(150deg, rgba(241, 255, 250, 0.96) 0%, rgba(212, 244, 233, 0.95) 40%, rgba(230, 245, 251, 0.92) 100%)',
    surface: 'rgba(255, 255, 255, 0.9)',
    accent: '#117a67',
    accentSoft: 'rgba(17, 122, 103, 0.16)',
    text: '#183030',
    muted: '#4b6764',
    ring: 'rgba(17, 122, 103, 0.24)',
    displayFont: '"Zen Kaku Gothic New", sans-serif',
    bodyFont: '"Zen Kaku Gothic New", sans-serif',
    badgeFont: '"Mochiy Pop One", sans-serif',
  },
  {
    id: 'twilight-boutique',
    label: 'Twilight Boutique',
    background:
      'linear-gradient(145deg, rgba(252, 247, 255, 0.96) 0%, rgba(234, 230, 255, 0.94) 44%, rgba(245, 240, 231, 0.92) 100%)',
    surface: 'rgba(255, 255, 255, 0.88)',
    accent: '#5a4ecb',
    accentSoft: 'rgba(90, 78, 203, 0.16)',
    text: '#241d42',
    muted: '#625f79',
    ring: 'rgba(90, 78, 203, 0.22)',
    displayFont: '"Shippori Mincho", serif',
    bodyFont: '"Zen Kaku Gothic New", sans-serif',
    badgeFont: '"Mochiy Pop One", sans-serif',
  },
];

const INITIAL_BRIEF: CampaignBrief = {
  headline: '春の注目アイテム特集',
  audience: '介護施設・在宅現場の仕入れ担当向け',
  tone: 'premium',
  directionNote: '新生活感を出しつつ、価格訴求は明快に。安心感よりも洗練感を優先。',
};

const INITIAL_PRODUCTS: ProductDraft[] = [
  {
    id: 'seed-1',
    imageUrl: '/template-images/image_04.png',
    imageName: 'image_04.png',
    imageWidth: 1200,
    imageHeight: 900,
    catchCopy: '食卓を軽やかに整える春の主役',
    listPrice: '4980',
    salePrice: '3980',
    makerName: '介援隊セレクト',
    campaignStart: '2026-03-02',
    campaignEnd: '2026-03-20',
  },
  {
    id: 'seed-2',
    imageUrl: '/template-images/image_09.png',
    imageName: 'image_09.png',
    imageWidth: 900,
    imageHeight: 900,
    catchCopy: '毎日使いたくなる軽量設計',
    listPrice: '3280',
    salePrice: '2680',
    makerName: 'ケアデザイン',
    campaignStart: '2026-03-05',
    campaignEnd: '2026-03-23',
  },
  {
    id: 'seed-3',
    imageUrl: '/template-images/image_12.png',
    imageName: 'image_12.png',
    imageWidth: 900,
    imageHeight: 900,
    catchCopy: '清潔感のある定番モデルを限定価格で',
    listPrice: '5980',
    salePrice: '4380',
    makerName: 'ライフサポート工房',
    campaignStart: '2026-03-08',
    campaignEnd: '2026-03-27',
  },
];

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fileNameToLabel(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^.]+$/, '');
  const normalized = withoutExt.replace(/[_-]+/g, ' ').trim();
  return normalized.length > 0 ? normalized : '新着アイテム';
}

function toPriceNumber(value: string): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}

function formatYen(value: string | number): string {
  const numeric = typeof value === 'number' ? value : toPriceNumber(value);
  if (!numeric) {
    return '価格未設定';
  }
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(numeric);
}

function getDiscountRate(product: ProductDraft): number {
  const listPrice = toPriceNumber(product.listPrice);
  const salePrice = toPriceNumber(product.salePrice);

  if (!listPrice || !salePrice || salePrice >= listPrice) {
    return 0;
  }

  return (listPrice - salePrice) / listPrice;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatCampaignPeriod(product: ProductDraft): string {
  if (!product.campaignStart && !product.campaignEnd) {
    return '期間未設定';
  }

  if (product.campaignStart && product.campaignEnd) {
    return `${product.campaignStart.replaceAll('-', '.')} - ${product.campaignEnd.replaceAll('-', '.')}`;
  }

  return `${(product.campaignStart || product.campaignEnd).replaceAll('-', '.')} から展開`;
}

function createBlankProduct(index: number): ProductDraft {
  const start = new Date();
  const end = new Date();
  end.setDate(start.getDate() + 14);

  return {
    id: createId(),
    imageUrl: '',
    imageName: '',
    imageWidth: 0,
    imageHeight: 0,
    catchCopy: `新着アイテム ${index}`,
    listPrice: '',
    salePrice: '',
    makerName: 'メーカー名',
    campaignStart: toDateInputValue(start),
    campaignEnd: toDateInputValue(end),
  };
}

async function createProductFromFile(file: File): Promise<ProductDraft> {
  const imageUrl = await readFileAsDataURL(file);
  const dimensions = await getImageDimensions(imageUrl);
  const start = new Date();
  const end = new Date();
  end.setDate(start.getDate() + 14);
  const label = fileNameToLabel(file.name);

  return {
    id: createId(),
    imageUrl,
    imageName: file.name,
    imageWidth: dimensions.width,
    imageHeight: dimensions.height,
    catchCopy: `${label}を主役にしたおすすめ提案`,
    listPrice: '',
    salePrice: '',
    makerName: 'メーカー名',
    campaignStart: toDateInputValue(start),
    campaignEnd: toDateInputValue(end),
  };
}

function getToneLabel(tone: DirectionTone): string {
  switch (tone) {
    case 'smart':
      return '情報整理を優先したスマート販促';
    case 'premium':
      return '上質感を押し出すエディトリアル販促';
    case 'energetic':
      return '値引き訴求を強く見せるインパクト販促';
    default:
      return '編集方針を自動調整';
  }
}

function getArtDirectionLabel(tone: DirectionTone, averageDiscountRate: number): string {
  if (tone === 'energetic' || averageDiscountRate >= 0.3) {
    return 'スピード感のある価格訴求を前面に';
  }

  if (tone === 'premium') {
    return '余白と質感で上品に見せる構成';
  }

  return '視線誘導を整理した信頼感重視の構成';
}

function getLayoutMode(productCount: number): LayoutMode {
  if (productCount <= 1) {
    return 'spotlight';
  }

  if (productCount <= 3) {
    return 'split';
  }

  return 'mosaic';
}

function getLayoutLabel(layoutMode: LayoutMode): string {
  switch (layoutMode) {
    case 'spotlight':
      return 'Hero Spotlight';
    case 'split':
      return 'Split Feature';
    case 'mosaic':
      return 'Mosaic Cascade';
    default:
      return 'Adaptive Layout';
  }
}

function createAiDesignDraft(
  products: ProductDraft[],
  brief: CampaignBrief,
  variantSeed: number
): AiDesignDraft {
  const renderProducts = products.filter(
    (product) => product.imageUrl || product.catchCopy.trim() || product.makerName.trim()
  );

  const safeProducts = renderProducts.length > 0 ? renderProducts : [createBlankProduct(1)];
  const discountRates = safeProducts.map((product) => getDiscountRate(product));
  const averageDiscountRate =
    discountRates.reduce((total, current) => total + current, 0) / Math.max(1, discountRates.length);
  const maxDiscountRate = Math.max(...discountRates, 0);
  const makerCount = new Set(
    safeProducts.map((product) => product.makerName.trim()).filter((name) => name.length > 0)
  ).size;
  const toneBoost = brief.tone === 'premium' ? 2 : brief.tone === 'energetic' ? 1 : 0;
  const stylePack = STYLE_PACKS[(variantSeed + safeProducts.length + makerCount + toneBoost) % STYLE_PACKS.length];
  const layoutMode = getLayoutMode(safeProducts.length);
  const layoutLabel = getLayoutLabel(layoutMode);

  let heroProductId: string | null = null;
  let strongestDiscount = 0;

  safeProducts.forEach((product) => {
    const discountRate = getDiscountRate(product);
    if (discountRate >= strongestDiscount) {
      strongestDiscount = discountRate;
      heroProductId = product.id;
    }
  });

  if (!heroProductId) {
    heroProductId = safeProducts[0]?.id ?? null;
  }

  const heroProduct =
    safeProducts.find((product) => product.id === heroProductId) ?? safeProducts[0] ?? createBlankProduct(1);
  const headline = brief.headline.trim() || `${heroProduct.makerName || 'おすすめ'} セレクション`;
  const audience = brief.audience.trim() || '店頭・営業チーム向け';
  const badgeText =
    maxDiscountRate >= 0.35 ? 'BEST VALUE' : brief.tone === 'premium' ? 'CURATED STYLE' : 'SMART PICK';
  const artDirection = getArtDirectionLabel(brief.tone, averageDiscountRate);
  const toneLabel = getToneLabel(brief.tone);
  const directionNote =
    brief.directionNote.trim() || '商品ごとの値引き率と期間情報を読み取り、視線誘導を自動で調整。';
  const insightLines = [
    `${safeProducts.length}点の商材を${layoutLabel}で再配置し、視線の流れを分散させすぎないよう制御。`,
    `${formatPercent(averageDiscountRate)}の平均値引き率を基準に、価格バッジの強さとアクセントカラーの面積を調整。`,
    `${makerCount > 1 ? `${makerCount}メーカーを色帯で整理` : '単一ブランドとして世界観を固定'}し、販促感より編集感を優先。`,
  ];
  const promptLine = `「${headline}」を軸に、${audience}へ向けて ${artDirection}。${directionNote}`;

  return {
    stylePack,
    renderProducts: safeProducts,
    heroProductId,
    toneLabel,
    layoutMode,
    layoutLabel,
    artDirection,
    headline,
    subline: `${audience} / ${toneLabel}`,
    badgeText,
    averageDiscountRate,
    maxDiscountRate,
    insightLines,
    promptLine,
  };
}

export function CampaignComposerPage() {
  const [brief, setBrief] = useState<CampaignBrief>(INITIAL_BRIEF);
  const [products, setProducts] = useState<ProductDraft[]>(INITIAL_PRODUCTS);
  const [activeProductId, setActiveProductId] = useState<string>(INITIAL_PRODUCTS[0]?.id ?? '');
  const [designVariant, setDesignVariant] = useState(0);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const bulkUploadRef = useRef<HTMLInputElement>(null);
  const replaceUploadRef = useRef<HTMLInputElement>(null);
  const deferredBrief = useDeferredValue(brief);
  const deferredProducts = useDeferredValue(products);
  const designDraft = createAiDesignDraft(deferredProducts, deferredBrief, designVariant);
  const activeProduct =
    products.find((product) => product.id === activeProductId) ?? products[0] ?? createBlankProduct(1);

  const posterStyle = {
    '--poster-bg': designDraft.stylePack.background,
    '--poster-surface': designDraft.stylePack.surface,
    '--poster-accent': designDraft.stylePack.accent,
    '--poster-accent-soft': designDraft.stylePack.accentSoft,
    '--poster-text': designDraft.stylePack.text,
    '--poster-muted': designDraft.stylePack.muted,
    '--poster-ring': designDraft.stylePack.ring,
    '--poster-display-font': designDraft.stylePack.displayFont,
    '--poster-body-font': designDraft.stylePack.bodyFont,
    '--poster-badge-font': designDraft.stylePack.badgeFont,
  } as CSSProperties;

  function updateBrief<Field extends keyof CampaignBrief>(field: Field, value: CampaignBrief[Field]) {
    setBrief((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateProduct<Field extends keyof ProductDraft>(
    id: string,
    field: Field,
    value: ProductDraft[Field]
  ) {
    setProducts((current) =>
      current.map((product) =>
        product.id === id
          ? {
              ...product,
              [field]: value,
            }
          : product
      )
    );
  }

  function handleAddBlankProduct() {
    const nextProduct = createBlankProduct(products.length + 1);
    setProducts((current) => [...current, nextProduct]);
    setActiveProductId(nextProduct.id);
    startTransition(() => {
      setDesignVariant((current) => current + 1);
    });
  }

  function handleRemoveProduct(id: string) {
    if (products.length <= 1) {
      return;
    }

    setProducts((current) => current.filter((product) => product.id !== id));

    if (activeProductId === id) {
      const fallback = products.find((product) => product.id !== id);
      setActiveProductId(fallback?.id ?? '');
    }

    startTransition(() => {
      setDesignVariant((current) => current + 1);
    });
  }

  async function appendProductsFromFiles(fileList: FileList) {
    setIsProcessingFiles(true);

    try {
      const nextProducts: ProductDraft[] = [];

      for (const file of Array.from(fileList)) {
        if (!file.type.startsWith('image/')) {
          continue;
        }

        const nextProduct = await createProductFromFile(file);
        nextProducts.push(nextProduct);
      }

      if (nextProducts.length === 0) {
        return;
      }

      setProducts((current) => [...current, ...nextProducts]);
      setActiveProductId(nextProducts[0].id);
      startTransition(() => {
        setDesignVariant((current) => current + 1);
      });
    } finally {
      setIsProcessingFiles(false);
    }
  }

  async function replaceProductImage(id: string, file: File) {
    const imageUrl = await readFileAsDataURL(file);
    const dimensions = await getImageDimensions(imageUrl);

    setProducts((current) =>
      current.map((product) =>
        product.id === id
          ? {
              ...product,
              imageUrl,
              imageName: file.name,
              imageWidth: dimensions.width,
              imageHeight: dimensions.height,
            }
          : product
      )
    );

    startTransition(() => {
      setDesignVariant((current) => current + 1);
    });
  }

  async function handleBulkUpload(event: ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    event.target.value = '';

    if (!fileList || fileList.length === 0) {
      return;
    }

    await appendProductsFromFiles(fileList);
  }

  async function handleReplaceUpload(event: ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    const targetId = replaceTargetId;
    event.target.value = '';

    if (!fileList || fileList.length === 0 || !targetId) {
      setReplaceTargetId(null);
      return;
    }

    try {
      await replaceProductImage(targetId, fileList[0]);
    } finally {
      setReplaceTargetId(null);
    }
  }

  function openReplacePicker(id: string) {
    setReplaceTargetId(id);
    replaceUploadRef.current?.click();
  }

  function handleRegenerateLayout() {
    startTransition(() => {
      setDesignVariant((current) => current + 1);
    });
  }

  return (
    <div className="campaign-composer-shell">
      <div className="campaign-glow campaign-glow-left" />
      <div className="campaign-glow campaign-glow-right" />

      <header className="campaign-header">
        <div>
          <p className="campaign-kicker">Campaign Composer</p>
          <h1>編集者が商材を入れるだけで、売れる見た目まで一気に組み上げる制作画面</h1>
          <p className="campaign-intro">
            画像を複数投入し、商品ごとのコピー・価格・メーカー・期間を入力すると、AIのアート
            ディレクターが誌面のようなレイアウトを即時提案する想定の画面です。
          </p>
        </div>

        <div className="campaign-header-actions">
          <div className="campaign-status-card">
            <span className="status-label">AI設計モード</span>
            <strong>{designDraft.stylePack.label}</strong>
            <p>{designDraft.artDirection}</p>
          </div>
          <button className="campaign-btn campaign-btn-primary" type="button" onClick={handleRegenerateLayout}>
            AIでもう一案つくる
          </button>
        </div>
      </header>

      <main className="campaign-main-grid">
        <section className="campaign-panel campaign-panel-form">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Input</p>
              <h2>案件ブリーフ</h2>
            </div>
            <span className="panel-caption">{products.length}商品を編集中</span>
          </div>

          <div className="campaign-brief-grid">
            <label className="campaign-field">
              案件タイトル
              <input
                className="campaign-input"
                type="text"
                value={brief.headline}
                onChange={(event) => updateBrief('headline', event.target.value)}
              />
            </label>

            <label className="campaign-field">
              想定読者
              <input
                className="campaign-input"
                type="text"
                value={brief.audience}
                onChange={(event) => updateBrief('audience', event.target.value)}
              />
            </label>

            <label className="campaign-field">
              トーン
              <select
                className="campaign-input"
                value={brief.tone}
                onChange={(event) => updateBrief('tone', event.target.value as DirectionTone)}
              >
                <option value="smart">スマート</option>
                <option value="premium">上質</option>
                <option value="energetic">インパクト重視</option>
              </select>
            </label>

            <label className="campaign-field campaign-field-wide">
              ディレクションメモ
              <textarea
                className="campaign-input campaign-textarea"
                value={brief.directionNote}
                onChange={(event) => updateBrief('directionNote', event.target.value)}
              />
            </label>
          </div>

          <div className="asset-toolbar">
            <button
              className="campaign-btn campaign-btn-secondary"
              type="button"
              onClick={() => bulkUploadRef.current?.click()}
              disabled={isProcessingFiles}
            >
              {isProcessingFiles ? '画像を解析中...' : '画像をまとめて追加'}
            </button>
            <button className="campaign-btn campaign-btn-secondary" type="button" onClick={handleAddBlankProduct}>
              空の商材カードを追加
            </button>
          </div>

          <div className="focus-summary-card">
            <p className="focus-summary-label">現在のフォーカス</p>
            <strong>{activeProduct.catchCopy}</strong>
            <div className="focus-summary-meta">
              <span>{activeProduct.makerName}</span>
              <span>{formatYen(activeProduct.salePrice || activeProduct.listPrice)}</span>
              <span>{formatCampaignPeriod(activeProduct)}</span>
            </div>
          </div>

          <div className="product-editor-list">
            {products.map((product, index) => {
              const discountRate = getDiscountRate(product);
              const isActive = product.id === activeProductId;

              return (
                <article
                  key={product.id}
                  className={`product-editor-card${isActive ? ' active' : ''}`}
                  onClick={() => setActiveProductId(product.id)}
                >
                  <div className="product-editor-media">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.catchCopy || product.imageName || '商品画像'} />
                    ) : (
                      <div className="product-editor-placeholder">
                        <span>NO IMAGE</span>
                      </div>
                    )}
                    <div className="product-editor-badge">{String(index + 1).padStart(2, '0')}</div>
                  </div>

                  <div className="product-editor-body">
                    <div className="product-editor-actions">
                      <div>
                        <strong>{product.makerName || 'メーカー未設定'}</strong>
                        <p>
                          {product.imageName || '画像未選択'}
                          {product.imageWidth > 0 && product.imageHeight > 0
                            ? ` / ${product.imageWidth}x${product.imageHeight}`
                            : ''}
                        </p>
                      </div>
                      <div className="product-action-row">
                        <button
                          className="campaign-icon-btn"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openReplacePicker(product.id);
                          }}
                        >
                          画像差し替え
                        </button>
                        <button
                          className="campaign-icon-btn danger"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRemoveProduct(product.id);
                          }}
                          disabled={products.length <= 1}
                        >
                          削除
                        </button>
                      </div>
                    </div>

                    <div className="product-form-grid">
                      <label className="campaign-field campaign-field-wide">
                        キャッチコピー
                        <input
                          className="campaign-input"
                          type="text"
                          value={product.catchCopy}
                          onChange={(event) => updateProduct(product.id, 'catchCopy', event.target.value)}
                        />
                      </label>

                      <label className="campaign-field">
                        メーカー名
                        <input
                          className="campaign-input"
                          type="text"
                          value={product.makerName}
                          onChange={(event) => updateProduct(product.id, 'makerName', event.target.value)}
                        />
                      </label>

                      <label className="campaign-field">
                        定価
                        <input
                          className="campaign-input"
                          type="number"
                          min="0"
                          value={product.listPrice}
                          onChange={(event) => updateProduct(product.id, 'listPrice', event.target.value)}
                        />
                      </label>

                      <label className="campaign-field">
                        販売特価
                        <input
                          className="campaign-input"
                          type="number"
                          min="0"
                          value={product.salePrice}
                          onChange={(event) => updateProduct(product.id, 'salePrice', event.target.value)}
                        />
                      </label>

                      <label className="campaign-field">
                        開始日
                        <input
                          className="campaign-input"
                          type="date"
                          value={product.campaignStart}
                          onChange={(event) => updateProduct(product.id, 'campaignStart', event.target.value)}
                        />
                      </label>

                      <label className="campaign-field">
                        終了日
                        <input
                          className="campaign-input"
                          type="date"
                          value={product.campaignEnd}
                          onChange={(event) => updateProduct(product.id, 'campaignEnd', event.target.value)}
                        />
                      </label>
                    </div>

                    <div className="product-metrics-row">
                      <span>{formatYen(product.listPrice)}</span>
                      <span>{formatYen(product.salePrice)}</span>
                      <span className={discountRate > 0 ? 'discount-pill active' : 'discount-pill'}>
                        {discountRate > 0 ? `${formatPercent(discountRate)} OFF` : '割引なし'}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <section className="campaign-panel campaign-panel-preview">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Preview</p>
              <h2>AIレイアウト提案</h2>
            </div>
            <span className="panel-caption">{designDraft.layoutLabel}</span>
          </div>

          <div className="ai-summary-grid">
            <article className="ai-metric-card">
              <span>配色</span>
              <strong>{designDraft.stylePack.label}</strong>
              <p>{designDraft.toneLabel}</p>
            </article>
            <article className="ai-metric-card">
              <span>平均値引き率</span>
              <strong>{formatPercent(designDraft.averageDiscountRate)}</strong>
              <p>最大 {formatPercent(designDraft.maxDiscountRate)}</p>
            </article>
            <article className="ai-metric-card">
              <span>レイアウト軸</span>
              <strong>{designDraft.layoutLabel}</strong>
              <p>{designDraft.artDirection}</p>
            </article>
          </div>

          <div className="poster-stage">
            <div className="poster-sheet" style={posterStyle}>
              <div className="poster-topbar">
                <span className="poster-topbar-badge">{designDraft.badgeText}</span>
                <div className="poster-topbar-pills">
                  <span>{designDraft.layoutLabel}</span>
                  <span>{designDraft.stylePack.label}</span>
                </div>
              </div>

              <header className="poster-header">
                <div>
                  <p className="poster-kicker">Auto Styled Campaign</p>
                  <h3>{designDraft.headline}</h3>
                  <p className="poster-subline">{designDraft.subline}</p>
                </div>
                <div className="poster-chip-column">
                  <span className="poster-chip">Color tuned</span>
                  <span className="poster-chip">Font layered</span>
                  <span className="poster-chip">Price emphasized</span>
                </div>
              </header>

              <div className={`poster-layout poster-layout-${designDraft.layoutMode}`}>
                {designDraft.renderProducts.map((product) => {
                  const discountRate = getDiscountRate(product);
                  const isHero = product.id === designDraft.heroProductId;

                  return (
                    <article key={product.id} className={`poster-card${isHero ? ' hero' : ''}`}>
                      <div className="poster-card-image-shell">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.catchCopy || product.imageName || '商品画像'} />
                        ) : (
                          <div className="poster-card-image-fallback">
                            <span>IMAGE SLOT</span>
                          </div>
                        )}
                        {discountRate > 0 ? (
                          <div className={`poster-discount-tag${isHero ? ' hero' : ''}`}>
                            {formatPercent(discountRate)} OFF
                          </div>
                        ) : null}
                      </div>

                      <div className="poster-card-body">
                        <p className="poster-maker">{product.makerName}</p>
                        <h4>{product.catchCopy || 'キャッチコピーを入力'}</h4>
                        <div className="poster-price-row">
                          <span>{formatYen(product.listPrice)}</span>
                          <strong>{formatYen(product.salePrice || product.listPrice)}</strong>
                        </div>
                        <p className="poster-period">{formatCampaignPeriod(product)}</p>
                      </div>
                    </article>
                  );
                })}
              </div>

              <footer className="poster-footer">
                <p>{brief.directionNote}</p>
                <div className="poster-swatch-row">
                  <span
                    className="poster-swatch"
                    style={{ background: designDraft.stylePack.accent } as CSSProperties}
                  />
                  <span
                    className="poster-swatch"
                    style={{ background: designDraft.stylePack.accentSoft } as CSSProperties}
                  />
                  <span
                    className="poster-swatch"
                    style={{ background: designDraft.stylePack.surface } as CSSProperties}
                  />
                </div>
              </footer>
            </div>
          </div>

          <div className="ai-detail-grid">
            <article className="ai-detail-card">
              <p className="detail-kicker">Design DNA</p>
              <h3>配色・書体・見せ方</h3>
              <div className="dna-block">
                <div className="dna-swatch-group">
                  <span
                    className="dna-swatch"
                    style={{ background: designDraft.stylePack.accent } as CSSProperties}
                  />
                  <span
                    className="dna-swatch"
                    style={{ background: designDraft.stylePack.accentSoft } as CSSProperties}
                  />
                  <span
                    className="dna-swatch"
                    style={{ background: designDraft.stylePack.ring } as CSSProperties}
                  />
                </div>
                <div className="dna-copy">
                  <strong>{designDraft.stylePack.label}</strong>
                  <p>{designDraft.toneLabel}</p>
                </div>
              </div>
              <div className="font-chip-stack">
                <span
                  className="font-chip"
                  style={{ fontFamily: designDraft.stylePack.displayFont } as CSSProperties}
                >
                  見出し: インパクト
                </span>
                <span
                  className="font-chip"
                  style={{ fontFamily: designDraft.stylePack.bodyFont } as CSSProperties}
                >
                  本文: 可読性
                </span>
                <span
                  className="font-chip"
                  style={{ fontFamily: designDraft.stylePack.badgeFont } as CSSProperties}
                >
                  バッジ: 瞬発力
                </span>
              </div>
            </article>

            <article className="ai-detail-card">
              <p className="detail-kicker">AI Reasoning</p>
              <h3>今回の自動判断</h3>
              <div className="insight-list">
                {designDraft.insightLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <div className="prompt-preview">
                <span>生成プロンプト要約</span>
                <p>{designDraft.promptLine}</p>
              </div>
            </article>
          </div>
        </section>
      </main>

      <input
        ref={bulkUploadRef}
        type="file"
        hidden
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        onChange={(event) => {
          void handleBulkUpload(event);
        }}
      />
      <input
        ref={replaceUploadRef}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        onChange={(event) => {
          void handleReplaceUpload(event);
        }}
      />
    </div>
  );
}
