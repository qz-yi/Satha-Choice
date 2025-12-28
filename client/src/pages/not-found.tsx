import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 text-gray-900">
      <div className="bg-white p-12 rounded-3xl shadow-xl text-center border border-gray-100 max-w-lg mx-4">
        <div className="bg-orange-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="h-12 w-12 text-orange-600" />
        </div>
        <h1 className="text-4xl font-extrabold mb-4 text-gray-900">404</h1>
        <p className="text-xl text-gray-600 mb-8 font-medium">عذراً، الصفحة التي تبحث عنها غير موجودة.</p>
        
        <Link href="/" className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-xl text-black bg-primary hover:bg-primary/90 transition-all duration-200">
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
