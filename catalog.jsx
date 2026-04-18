/* Catalog of real stocks & crypto for smart search */

const STOCK_CATALOG = [
  // ASX
  { sym: "CBA.AX", name: "Commonwealth Bank of Australia", exchange: "ASX", price: 125.00, ccy: "AUD", change24h: -0.34 },
  { sym: "CSL.AX", name: "CSL Limited", exchange: "ASX", price: 301.00, ccy: "AUD", change24h: 0.82 },
  { sym: "BHP.AX", name: "BHP Group", exchange: "ASX", price: 44.20, ccy: "AUD", change24h: 1.02 },
  { sym: "WBC.AX", name: "Westpac Banking Corp", exchange: "ASX", price: 28.15, ccy: "AUD", change24h: 0.18 },
  { sym: "NAB.AX", name: "National Australia Bank", exchange: "ASX", price: 37.82, ccy: "AUD", change24h: -0.22 },
  { sym: "ANZ.AX", name: "ANZ Group", exchange: "ASX", price: 30.45, ccy: "AUD", change24h: 0.08 },
  { sym: "WES.AX", name: "Wesfarmers Limited", exchange: "ASX", price: 72.10, ccy: "AUD", change24h: 0.56 },
  { sym: "WOW.AX", name: "Woolworths Group", exchange: "ASX", price: 34.60, ccy: "AUD", change24h: -0.14 },
  { sym: "MQG.AX", name: "Macquarie Group", exchange: "ASX", price: 218.30, ccy: "AUD", change24h: 1.42 },
  { sym: "TLS.AX", name: "Telstra Group", exchange: "ASX", price: 3.92, ccy: "AUD", change24h: -0.12 },
  { sym: "RIO.AX", name: "Rio Tinto", exchange: "ASX", price: 118.40, ccy: "AUD", change24h: 0.78 },
  { sym: "FMG.AX", name: "Fortescue", exchange: "ASX", price: 19.40, ccy: "AUD", change24h: -1.14 },
  { sym: "VAS.AX", name: "Vanguard Australian Shares Index ETF", exchange: "ASX", price: 101.00, ccy: "AUD", change24h: 0.41 },
  { sym: "VTS.AX", name: "Vanguard US Total Market ETF", exchange: "ASX", price: 388.00, ccy: "AUD", change24h: 0.15 },
  { sym: "VGS.AX", name: "Vanguard MSCI Intl Shares ETF", exchange: "ASX", price: 128.40, ccy: "AUD", change24h: 0.34 },
  { sym: "IVV.AX", name: "iShares S&P 500 ETF", exchange: "ASX", price: 62.80, ccy: "AUD", change24h: 0.28 },
  { sym: "NDQ.AX", name: "Betashares NASDAQ 100 ETF", exchange: "ASX", price: 52.90, ccy: "AUD", change24h: 0.72 },

  // NASDAQ / NYSE
  { sym: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", price: 213.10, ccy: "USD", change24h: 1.12 },
  { sym: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", price: 446.20, ccy: "USD", change24h: 0.54 },
  { sym: "GOOGL", name: "Alphabet Inc. Class A", exchange: "NASDAQ", price: 198.40, ccy: "USD", change24h: 0.31 },
  { sym: "AMZN", name: "Amazon.com Inc.", exchange: "NASDAQ", price: 221.80, ccy: "USD", change24h: 0.92 },
  { sym: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", price: 812.40, ccy: "USD", change24h: 2.44 },
  { sym: "META", name: "Meta Platforms Inc.", exchange: "NASDAQ", price: 582.10, ccy: "USD", change24h: 0.78 },
  { sym: "TSLA", name: "Tesla Inc.", exchange: "NASDAQ", price: 291.60, ccy: "USD", change24h: -1.24 },
  { sym: "BRK.B", name: "Berkshire Hathaway Class B", exchange: "NYSE", price: 478.20, ccy: "USD", change24h: 0.18 },
  { sym: "JPM", name: "JPMorgan Chase & Co.", exchange: "NYSE", price: 248.90, ccy: "USD", change24h: 0.38 },
  { sym: "V", name: "Visa Inc.", exchange: "NYSE", price: 312.40, ccy: "USD", change24h: 0.22 },
  { sym: "MA", name: "Mastercard Inc.", exchange: "NYSE", price: 524.10, ccy: "USD", change24h: 0.45 },
  { sym: "SPY", name: "SPDR S&P 500 ETF", exchange: "NYSE", price: 598.40, ccy: "USD", change24h: 0.22 },
  { sym: "VOO", name: "Vanguard S&P 500 ETF", exchange: "NYSE", price: 551.20, ccy: "USD", change24h: 0.24 },
  { sym: "QQQ", name: "Invesco QQQ Trust", exchange: "NASDAQ", price: 521.60, ccy: "USD", change24h: 0.72 },
];

const CRYPTO_CATALOG = [
  { sym: "BTC", name: "Bitcoin",        price: 98100,  ccy: "USD", change24h: 3.12, mcap: "1.94T" },
  { sym: "ETH", name: "Ethereum",       price: 2640,   ccy: "USD", change24h: 1.88, mcap: "318B" },
  { sym: "SOL", name: "Solana",         price: 62.0,   ccy: "USD", change24h: -2.10, mcap: "29.8B" },
  { sym: "BNB", name: "BNB",            price: 710,    ccy: "USD", change24h: 0.42, mcap: "103B" },
  { sym: "XRP", name: "XRP",            price: 2.18,   ccy: "USD", change24h: 4.12, mcap: "124B" },
  { sym: "ADA", name: "Cardano",        price: 0.72,   ccy: "USD", change24h: 1.42, mcap: "25.4B" },
  { sym: "AVAX",name: "Avalanche",      price: 38.2,   ccy: "USD", change24h: 2.80, mcap: "15.1B" },
  { sym: "DOGE",name: "Dogecoin",       price: 0.31,   ccy: "USD", change24h: -0.82, mcap: "45.2B" },
  { sym: "LINK",name: "Chainlink",      price: 22.4,   ccy: "USD", change24h: 2.14, mcap: "14.1B" },
  { sym: "DOT", name: "Polkadot",       price: 7.12,   ccy: "USD", change24h: -1.20, mcap: "10.8B" },
  { sym: "MATIC",name:"Polygon",        price: 0.48,   ccy: "USD", change24h: 0.62, mcap: "4.5B" },
  { sym: "LTC", name: "Litecoin",       price: 108,    ccy: "USD", change24h: 1.02, mcap: "8.1B" },
  { sym: "UNI", name: "Uniswap",        price: 12.4,   ccy: "USD", change24h: 3.22, mcap: "7.4B" },
  { sym: "ATOM",name: "Cosmos",         price: 6.82,   ccy: "USD", change24h: -0.44, mcap: "2.7B" },
  { sym: "ARB", name: "Arbitrum",       price: 0.92,   ccy: "USD", change24h: 2.64, mcap: "4.4B" },
  { sym: "OP",  name: "Optimism",       price: 2.14,   ccy: "USD", change24h: 1.82, mcap: "2.9B" },
];

// Goal targets
const GOALS = [
  {
    id: "retirement",
    name: "Retirement at 55",
    icon: "⛱",
    target: 6_500_000,
    deadline: "2036-06-01",
    start: 1_720_000,
    startDate: "2021-04-18",
    note: "Comfortable retirement — $180k/yr drawdown",
  },
  {
    id: "mortgage-free",
    name: "Mortgage-free",
    icon: "🏠",
    target: 0,
    kind: "liability",
    deadline: "2032-12-31",
    start: -1_450_000,
    startDate: "2022-01-01",
    note: "Pay off both mortgages",
    current: -1_600_000,
  },
  {
    id: "kids-uni",
    name: "Kids' education fund",
    icon: "🎓",
    target: 450_000,
    deadline: "2031-01-01",
    start: 0,
    startDate: "2024-01-01",
    note: "Two children, 10 years of private + uni",
    current: 142_000,
  },
];

Object.assign(window, { STOCK_CATALOG, CRYPTO_CATALOG, GOALS });
