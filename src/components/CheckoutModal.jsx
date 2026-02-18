import React, { useState } from "react";
import {
  CheckCircle,
  Loader2,
  AlertTriangle,
  Truck,
  CalendarCheck,
  Clock,
  Package,
  RefreshCw,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { useSupabaseAuth } from "@/context/SupabaseAuthContext";
import { schlosserApi } from "@/services/schlosserApi";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { calculateOrderMetrics } from "@/utils/calculateOrderMetrics";
import { calcularEstoqueData } from "@/utils/stockValidator";
import { supabase } from "@/lib/customSupabaseClient";

const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

// ======= CORTE (DIA ANTERIOR) =======
const parseCutoff = (cutoffStr) => {
  const clean = String(cutoffStr || "")
    .replace("h", "")
    .trim();
  const [hh, mm] = clean.split(":").map((x) => parseInt(x, 10));
  return {
    h: Number.isFinite(hh) ? hh : 17,
    m: Number.isFinite(mm) ? mm : 30,
  };
};

// true => já passou do corte (não pode pedir)
const isPastCutoffForDelivery = (deliveryDateISO, cutoffStr) => {
  const { h, m } = parseCutoff(cutoffStr);

  const delivery = new Date(`${deliveryDateISO}T00:00:00`);
  if (isNaN(delivery.getTime())) return true;

  const cutoff = new Date(delivery);
  cutoff.setDate(cutoff.getDate() - 1); // dia anterior
  cutoff.setHours(h, m, 0, 0);

  return new Date() > cutoff;
};

const CheckoutModal = ({ isOpen, onClose, selectedClient }) => {
  const { cartItems, deliveryInfo, clearCart, notifyStockUpdate } = useCart();
  const { user } = useSupabaseAuth(); // perfil interno (public.usuarios)
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [obs, setObs] = useState("");

  const { processedItems, totalWeight, totalValue } = calculateOrderMetrics(cartItems);

  const formatMoney = (val) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(val || 0));

  const getDeliveryDateISO = () => {
    const raw = deliveryInfo?.delivery_date || deliveryInfo?.date || deliveryInfo?.deliveryDate;
    if (!raw) return null;

    if (raw instanceof Date) {
      if (isNaN(raw.getTime())) return null;
      return raw.toISOString().split("T")[0];
    }

    const str = String(raw).trim();
    if (!str) return null;

    if (str.includes("T")) return str.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];

    return null;
  };

  const performFinalValidation = async () => {
    setValidating(true);
    setValidationErrors([]);
    const errors = [];

    try {
      const dateStr = getDeliveryDateISO();
      if (!dateStr) {
        errors.push("Data de entrega não definida.");
      } else {
        // ✅ REGRA DO CORTE (dia anterior)
        const cutoffStr = deliveryInfo?.route_cutoff || "17:30h";
        if (isPastCutoffForDelivery(dateStr, cutoffStr)) {
          errors.push(
            `Pra entrega em ${dateStr}, o corte foi ${cutoffStr} do dia anterior. Selecione a próxima data disponível.`
          );
        }

        // ✅ valida estoque por item na data
        for (const item of processedItems) {
          const code = String(item.codigo ?? item.sku ?? "").trim();
          const desiredQty = Number(item.quantity ?? item.quantidade ?? item.quantity_unit ?? 0);

          const available = await calcularEstoqueData(code, dateStr);

          if (available < desiredQty) {
            errors.push(`${item.name}: Estoque insuficiente para ${dateStr} (${available} disponíveis).`);
          }
        }
      }
    } catch (e) {
      console.error("Validation error:", e);
      errors.push("Erro ao conectar com servidor para validação de estoque.");
    } finally {
      setValidating(false);
      setValidationErrors(errors);
      return errors.length === 0;
    }
  };

  const handleConfirm = async () => {
    const isValid = await performFinalValidation();
    if (!isValid) {
      toast({
        title: "Erro de Validação",
        description: "O estoque mudou, a data é inválida ou é insuficiente. Verifique os erros acima.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // ✅ Auth real (o que o RLS enxerga)
      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;

      const authUid = u?.user?.id;
      if (!authUid) throw new Error("Usuário não autenticado. Faça login novamente.");

      // Guardrails mínimos
      if (!selectedClient?.cnpj) throw new Error("Dados do cliente incompletos (CNPJ).");
      if (!Array.isArray(cartItems) || cartItems.length === 0) throw new Error("Carrinho vazio.");

      const deliveryDateISO = getDeliveryDateISO();
      if (!deliveryDateISO) throw new Error("Data de entrega inválida.");

      // ✅ vendor_id informativo: vem do perfil interno
      const vendorIdNorm = onlyDigits(user?.login || "");
      const vendorName = user?.usuario || user?.Usuario || user?.name || "Vendedor";

      if (!vendorIdNorm) {
        throw new Error("Perfil interno sem login (telefone). Verifique public.usuarios.login.");
      }

      const itemsPayload = processedItems.map((item) => ({
        sku: item.codigo ?? item.sku,
        name: item.name,
        quantity_unit: item.quantity,
        unit_type: item.unitType,
        quantity_kg: item.estimatedWeight,
        price_per_kg: item.pricePerKg,
        total: item.estimatedValue,
      }));

      const orderData = {
        vendor_uid: authUid, // ✅ RLS usa auth.uid()
        vendor_id: vendorIdNorm, // informativo/relatório
        vendor_name: vendorName,

        client_id: selectedClient.cnpj,
        client_name: selectedClient.nomeFantasia,
        client_cnpj: selectedClient.cnpj,

        route_id: deliveryInfo?.route_code?.toString(),
        route_name: deliveryInfo?.route_name,
        delivery_date: deliveryDateISO,
        delivery_city: deliveryInfo?.route_city || selectedClient?.municipio,
        cutoff: deliveryInfo?.route_cutoff,

        items: itemsPayload,
        total_value: totalValue,
        total_weight: totalWeight,

        observations: obs,
        status: "PEDIDO ENVIADO",
        created_at: new Date().toISOString(),
      };

      const { data: orderResult, error: orderError } = await supabase
        .from("pedidos")
        .insert([orderData])
        .select()
        .single();

      if (orderError) throw new Error(`Falha ao criar pedido: ${orderError.message}`);

      // Sync externo (fail-safe)
      try {
        await schlosserApi.saveOrderToSheets(orderData, vendorName);
      } catch (sheetErr) {
        console.warn("[Checkout] Sheet sync failed (fail-safe):", sheetErr);
      }

      toast({
        title: "Sucesso! ✅",
        description: "Pedido enviado e registrado com sucesso.",
        className: "bg-green-50 border-green-200 text-green-900",
      });

      notifyStockUpdate();
      clearCart();
      onClose();

      // ✅ DASHBOARD NÃO SUMIR: /vendedor NÃO EXISTE -> usa /dashboard
      navigate("/vendedor");
    } catch (error) {
      console.error("Checkout Fatal Error:", error);
      toast({
        title: "Erro ao confirmar pedido",
        description: error?.message || "Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deliveryDateForCard = deliveryInfo?.delivery_date ? new Date(deliveryInfo.delivery_date) : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !loading && onClose(open)}>
      <DialogContent className="sm:max-w-lg bg-white overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="px-1">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CalendarCheck className="text-green-600" />
            Confirmar Pedido
          </DialogTitle>
          <DialogDescription>Revise os detalhes da entrega e os itens do pedido antes de finalizar.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-5 py-2">
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
                <AlertTriangle className="w-4 h-4" />
                Problemas Encontrados
              </div>
              <ul className="list-disc list-inside text-red-600 space-y-1 text-xs">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-100"
                  onClick={performFinalValidation}
                  disabled={validating || loading}
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${validating ? "animate-spin" : ""}`} />
                  Revalidar
                </Button>
              </div>
            </div>
          )}

          {selectedClient && deliveryInfo?.delivery_date && (
            <div className="bg-[#FFF5EB] border border-orange-100 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-orange-50 px-4 py-2 border-b border-orange-100 flex justify-between items-center">
                <h3 className="text-xs font-bold text-orange-700 uppercase tracking-wider flex items-center gap-1">
                  <Truck size={12} /> Logística de Entrega
                </h3>
              </div>

              <div className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center justify-center p-2.5 bg-white text-orange-600 rounded-lg border border-orange-100 min-w-[70px] shadow-sm">
                    <span className="text-[10px] font-bold uppercase text-gray-400">
                      {deliveryDateForCard ? format(deliveryDateForCard, "EEE", { locale: ptBR }) : "--"}
                    </span>
                    <span className="text-2xl font-bold leading-none">
                      {deliveryDateForCard ? format(deliveryDateForCard, "d") : "--"}
                    </span>
                    <span className="text-[10px] uppercase font-bold">
                      {deliveryDateForCard ? format(deliveryDateForCard, "MMM", { locale: ptBR }) : "--"}
                    </span>
                  </div>

                  <div className="space-y-1 pt-1">
                    <p className="text-sm font-bold text-gray-800 leading-tight">{deliveryInfo?.route_name}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-600 flex items-center gap-1">
                        <Clock size={10} className="text-orange-500" /> Corte: {deliveryInfo?.route_cutoff}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
              <Package size={12} /> Resumo dos Itens ({processedItems.length})
            </h4>

            <div className="border rounded-lg overflow-hidden border-gray-100">
              <div className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                {processedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col text-sm bg-white p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-medium text-gray-700 leading-snug">{item.name}</span>
                      <span className="font-bold text-gray-900 whitespace-nowrap">{item.formattedValue}</span>
                    </div>

                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 rounded border border-gray-100">
                        {item.quantity} {item.unitType}
                      </span>
                      <div className="text-[10px] text-gray-500 font-mono">
                        {Number(item.estimatedWeight || 0).toFixed(2)}kg est. × {formatMoney(item.pricePerKg)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block">Observações do Pedido</label>
            <textarea
              className="w-full text-sm border border-gray-200 rounded-md p-2 h-20 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none bg-white placeholder:text-gray-300"
              placeholder="Ex: Entregar na porta dos fundos, ligar antes..."
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 mt-2 border-t border-gray-100">
          <div className="flex-1 flex justify-between items-center sm:justify-start sm:gap-4 mb-2 sm:mb-0">
            <span className="text-sm font-medium text-gray-500">Total Final (Est.)</span>
            <span className="text-2xl font-bold text-[#FF8C42]">{formatMoney(totalValue)}</span>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => onClose()} disabled={loading} className="flex-1 sm:flex-none">
              Cancelar
            </Button>

            <Button
              onClick={handleConfirm}
              className="bg-[#FF8C42] hover:bg-[#E67E22] text-white flex-1 sm:flex-none min-w-[140px]"
              disabled={
                loading || validating || !selectedClient || !deliveryInfo?.delivery_date || validationErrors.length > 0
              }
            >
              {loading || validating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              {loading ? "Processando..." : validating ? "Validando..." : "Confirmar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;
