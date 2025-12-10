import { motion } from "framer-motion";
import { ArrowRight, Bot, Shield, Zap, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { FeaturesSection } from "@/components/features/FeaturesSection";
import { PricingSection } from "@/components/pricing/PricingSection";
import LogoCarousel from "@/components/LogoCarousel";
import TestimonialsSection from "@/components/TestimonialsSection";
import Footer from "@/components/Footer";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      
      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative container px-4 pt-40 pb-20"
      >
        {/* Background Effects */}
        <div className="absolute inset-0 -z-10 gradient-bg" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10" />
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-block mb-6 px-4 py-2 rounded-full glass"
        >
          <span className="text-sm font-medium flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            Algorithmic Copy Trading Platform
          </span>
        </motion.div>
        
        <div className="max-w-4xl relative z-10">
          <h1 className="text-5xl md:text-7xl font-semibold mb-6 tracking-tight text-left leading-[1.1]">
            <span className="text-muted-foreground">
              <TextGenerateEffect words="Copy trade with" />
            </span>
            <br />
            <span className="text-gradient">
              <TextGenerateEffect words="Algorithmic powered trading" />
            </span>
          </h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl text-left"
          >
            Connect your brokerage, subscribe to proven trading strategies, and let our 
            algorithms execute trades automatically.{" "}
            <span className="text-foreground font-medium">Start with a $10,000 demo account.</span>
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 items-start"
          >
            <Button 
              size="lg" 
              className="button-gradient text-base px-8"
              onClick={() => navigate('/auth')}
            >
              Start Free Trial
            </Button>
            <Button 
              size="lg" 
              variant="ghost" 
              className="text-foreground hover:text-primary group"
              onClick={() => navigate('/auth')}
            >
              View Trading Strategies <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </motion.div>
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-4xl"
        >
          {[
            { label: 'Active Traders', value: '12,500+' },
            { label: 'Monthly Volume', value: '$84M+' },
            { label: 'Avg. Win Rate', value: '68.4%' },
            { label: 'Trading Strategies', value: '24' },
          ].map((stat, i) => (
            <div key={i} className="text-left">
              <p className="text-2xl md:text-3xl font-semibold font-mono text-gradient">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="relative mx-auto max-w-5xl mt-20"
        >
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-75 -z-10" />
          <div className="glass rounded-2xl overflow-hidden glow-primary">
            <img
              src="/lovable-uploads/c32c6788-5e4a-4fee-afee-604b03113c7f.png"
              alt="JadeTrade Dashboard"
              className="w-full h-auto"
            />
          </div>
        </motion.div>
      </motion.section>

      {/* How It Works */}
      <section className="container px-4 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-semibold mb-4">
            How It <span className="text-gradient">Works</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Get started in minutes with our simple 3-step process
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              icon: Shield,
              title: 'Create Account',
              description: 'Sign up and verify your identity. Get instant access to a $10,000 demo portfolio.',
            },
            {
              step: '02',
              icon: Bot,
              title: 'Choose Your Strategies',
              description: 'Browse our marketplace of proven algorithms. Subscribe to strategies that match your goals.',
            },
            {
              step: '03',
              icon: TrendingUp,
              title: 'Start Trading',
              description: 'Connect your brokerage and let our strategies execute trades automatically 24/7.',
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-xl p-8 relative group hover:bg-white/10 transition-colors"
            >
              <span className="text-6xl font-bold text-primary/10 absolute top-4 right-4">
                {item.step}
              </span>
              <item.icon className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
              <p className="text-muted-foreground">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Logo Carousel */}
      <LogoCarousel />

      {/* Features Section */}
      <div id="features" className="bg-background">
        <FeaturesSection />
      </div>

      {/* Pricing Section */}
      <div id="pricing" className="bg-background">
        <PricingSection />
      </div>

      {/* Testimonials Section */}
      <div className="bg-background">
        <TestimonialsSection />
      </div>

      {/* CTA Section */}
      <section className="container px-4 py-20 relative">
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'url("/lovable-uploads/21f3edfb-62b5-4e35-9d03-7339d803b980.png")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass rounded-3xl p-8 md:p-16 text-center relative z-10"
        >
          <h2 className="text-3xl md:text-5xl font-semibold mb-4">
            Ready to <span className="text-gradient">automate</span> your trading?
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            Join thousands of traders already using our algorithms to generate consistent returns.
          </p>
          <Button 
            size="lg" 
            className="button-gradient text-base px-10"
            onClick={() => navigate('/auth')}
          >
            Start Free Trial
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Index;