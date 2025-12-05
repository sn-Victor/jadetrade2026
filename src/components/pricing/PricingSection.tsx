import { motion } from "framer-motion";
import { Check, Zap, Shield, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardSpotlight } from "./CardSpotlight";
import { useNavigate } from "react-router-dom";

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: null,
    description: "Perfect for getting started with algorithmic trading",
    icon: Zap,
    color: "text-green-500",
    features: [
      "$10,000 demo portfolio",
      "Access to 2 basic bots",
      "Daily performance reports",
      "Community support",
      "Basic analytics dashboard",
    ],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    description: "For serious traders who want more powerful strategies",
    icon: Shield,
    color: "text-primary",
    features: [
      "Everything in Free, plus:",
      "Access to 4 pro bots",
      "Real brokerage connection",
      "Advanced risk management",
      "Priority email support",
      "Custom bot parameters",
      "Real-time alerts",
    ],
    cta: "Start Pro Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$199",
    period: "/month",
    description: "Maximum returns with our most advanced algorithms",
    icon: Crown,
    color: "text-purple-500",
    features: [
      "Everything in Pro, plus:",
      "All 6 enterprise bots",
      "AI sentiment analysis",
      "Cross-exchange arbitrage",
      "Dedicated account manager",
      "Custom strategy development",
      "API access",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export const PricingSection = () => {
  const navigate = useNavigate();

  return (
    <section className="container px-4 py-24">
      <div className="max-w-2xl mx-auto text-center mb-12">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-semibold mb-6"
        >
          Simple, Transparent{" "}
          <span className="text-gradient">Pricing</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-lg text-muted-foreground"
        >
          Choose the plan that fits your trading goals. Upgrade or downgrade anytime.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {tiers.map((tier, index) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
          >
            <CardSpotlight className={`h-full ${tier.popular ? "border-primary" : "border-border"} border-2`}>
              <div className="relative h-full p-6 flex flex-col">
                {tier.popular && (
                  <span className="text-xs font-medium bg-primary/10 text-primary rounded-full px-3 py-1 w-fit mb-4">
                    Most Popular
                  </span>
                )}
                
                <div className={`w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-4`}>
                  <tier.icon className={`w-5 h-5 ${tier.color}`} />
                </div>

                <h3 className="text-xl font-semibold mb-2">{tier.name}</h3>
                <div className="mb-2">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  {tier.period && <span className="text-muted-foreground">{tier.period}</span>}
                </div>
                <p className="text-sm text-muted-foreground mb-6">{tier.description}</p>
                
                <ul className="space-y-3 mb-8 flex-grow">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className={`w-4 h-4 mt-0.5 ${tier.color}`} />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  className={`w-full ${tier.popular ? 'button-gradient' : ''}`}
                  variant={tier.popular ? 'default' : 'outline'}
                  onClick={() => navigate('/auth')}
                >
                  {tier.cta}
                </Button>
              </div>
            </CardSpotlight>
          </motion.div>
        ))}
      </div>
    </section>
  );
};