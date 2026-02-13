import React from 'react';
import { WizardStep } from '../types';

interface StepWizardProps {
  currentStep: WizardStep;
  salesUploaded: boolean;
  gstr1Uploaded: boolean;
  reconciled: boolean;
}

const steps: { key: WizardStep; label: string; icon: string }[] = [
  { key: 'upload', label: 'Upload Files', icon: '1' },
  { key: 'process', label: 'Process & Reconcile', icon: '2' },
  { key: 'review', label: 'Review Results', icon: '3' },
  { key: 'export', label: 'Export Reports', icon: '4' },
];

export default function StepWizard({ currentStep, salesUploaded, gstr1Uploaded, reconciled }: StepWizardProps) {
  const stepIndex = steps.findIndex(s => s.key === currentStep);

  function isCompleted(step: WizardStep) {
    switch (step) {
      case 'upload': return salesUploaded && gstr1Uploaded;
      case 'process': return reconciled;
      case 'review': return reconciled;
      case 'export': return false;
      default: return false;
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => {
          const active = step.key === currentStep;
          const completed = isCompleted(step.key) && stepIndex > idx;
          const upcoming = stepIndex < idx;

          return (
            <React.Fragment key={step.key}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                  ${completed ? 'bg-green-500 text-white' : ''}
                  ${active ? 'bg-blue-600 text-white ring-4 ring-blue-100' : ''}
                  ${upcoming ? 'bg-gray-200 text-gray-500' : ''}
                  ${!active && !completed && !upcoming ? 'bg-gray-300 text-gray-600' : ''}
                `}>
                  {completed ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  ) : step.icon}
                </div>
                <span className={`text-sm font-medium hidden sm:inline
                  ${active ? 'text-blue-700' : completed ? 'text-green-700' : 'text-gray-500'}
                `}>
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 rounded
                  ${idx < stepIndex ? 'bg-green-400' : 'bg-gray-200'}
                `} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
