import { Bot, Shield, TrendingUp, Zap } from "lucide-react";

export const features = [
  {
    title: "Algorithmic Trading Bots",
    description: "Choose from a variety of proven trading algorithms including momentum, mean reversion, trend following, and arbitrage strategies.",
    icon: <Bot className="w-6 h-6" />,
    image: "/lovable-uploads/c32c6788-5e4a-4fee-afee-604b03113c7f.png",
  },
  {
    title: "Automated Execution",
    description: "Our bots execute trades automatically 24/7, ensuring you never miss an opportunity even while you sleep.",
    icon: <Zap className="w-6 h-6" />,
    image: "/lovable-uploads/7cc724d4-3e14-4e7c-9e7a-8d613fde54d0.png",
  },
  {
    title: "Risk Management",
    description: "Built-in stop-loss, take-profit, and position sizing rules protect your capital and maximize risk-adjusted returns.",
    icon: <Shield className="w-6 h-6" />,
    image: "/lovable-uploads/86329743-ee49-4f2e-96f7-50508436273d.png",
  },
  {
    title: "Performance Analytics",
    description: "Track every trade, analyze bot performance, and optimize your strategy with comprehensive analytics dashboards.",
    icon: <TrendingUp className="w-6 h-6" />,
    image: "/lovable-uploads/bf56a0c6-48e4-49f7-b286-8e3fda9a3385.png",
  },
];