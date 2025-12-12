import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ChatWidget } from "@/components/chat/ChatWidget";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Bots from "./pages/Bots";
import CreateBot from "./pages/CreateBot";
import Admin from "./pages/Admin";
import Exchanges from "./pages/Exchanges";
import SmartTrade from "./pages/SmartTrade";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/smarttrade" element={<SmartTrade />} />
              <Route path="/bots" element={<Bots />} />
              <Route path="/bots/create" element={<CreateBot />} />
              <Route path="/exchanges" element={<Exchanges />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </BrowserRouter>
          <ChatWidget />
        </div>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;