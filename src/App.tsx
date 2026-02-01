import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import IndexModern from "./pages/Index_Modern";
import ErrorBoundary from "./components/ErrorBoundary";
import { NotFoundPage, UnauthorizedPage } from "./components/pages";
import { ThemeProvider } from "./components/theme-provider";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="system" storageKey="absenta-ui-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ErrorBoundary>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<IndexModern />} />
              {/* Error pages */}
              <Route path="/unauthorized" element={<UnauthorizedPage type="unauthorized" />} />
              <Route path="/forbidden" element={<UnauthorizedPage type="forbidden" />} />
              {/* Catch-all 404 route - MUST BE LAST */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
