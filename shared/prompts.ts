import * as fs from 'fs';
import * as path from 'path';

/**
 * Carga el prompt simplificado del Green Agent desde el archivo Markdown
 * Este es el ÚNICO prompt usado tanto para WhatsApp como para el dashboard
 */
export function loadSimpleGreenPrompt(): string {
  const promptPath = path.join(process.cwd(), 'prompts', 'green-agent-simple.md');
  try {
    return fs.readFileSync(promptPath, 'utf-8');
  } catch (error) {
    console.error('Error cargando prompt del Green Agent:', error);
    // Fallback en caso de error
    return `Eres un asistente de autorización médica. Ayuda a pacientes a autorizar procedimientos.

FLUJO:
1. Pregunta qué procedimiento necesita
2. Pide su cédula
3. Pregunta si tiene documentos
4. Registra con registerPatient

TOOLS:
- getPatientInfo: buscar paciente por teléfono o cédula
- searchProcedures: buscar procedimientos médicos
- registerPatient: OBLIGATORIO - registrar solicitud (usa status="approved" si tiene docs, "info_needed" si no)

Respuestas cortas (max 30 palabras). Una pregunta por mensaje.`;
  }
}
