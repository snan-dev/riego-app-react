import { useNavigate } from 'react-router-dom';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useMQTT } from '../../hooks/useMQTT';
import { useIrrigation } from '../../hooks/useIrrigation';
import { useState } from 'react';
import {
  Wrapper, Bg, Content, CloseBtn, IconRing, WaterDrops, Drop,
  ModeLabel, ZoneTitle, ProgressContainer, ProgressBar, ProgressFill,
  ProgressTimes, Controls, PauseBtn, StopBtn, ZoneChips, ZoneChip, ChipDot,
} from './Player.styles';

const ZONE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];

export function Player() {
  const navigate = useNavigate();
  const { status, programs } = useMQTT();
  const { togglePause, cancelProgram } = useIrrigation();
  const [confirmStop, setConfirmStop] = useState(false);

  // Si no hay riego activo, volver al home
  if (!status || status.mode === 'idle' || status.mode === 'manual') {
    navigate('/', { replace: true });
    return null;
  }

  const isPaused = status.mode === 'paused';
  const prog = programs.find(p => p.id === status.program);
  const rem  = status.remaining ?? 0;

  // Calcular progreso: buscar duración de la zona actual en el programa
  const zoneDuration = prog ? prog.zones[(status.zone ?? 1) - 1] : 0;
  const elapsed  = Math.max(0, zoneDuration - rem);
  const progress = zoneDuration > 0 ? Math.min(100, (elapsed / zoneDuration) * 100) : 0;

  return (
    <Wrapper>
      <Bg />
      <Content>
        <CloseBtn onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </CloseBtn>

        <IconRing $paused={isPaused}>
          <WaterDrops $paused={isPaused}>
            <Drop style={{ animationDelay: '0s' }} />
            <Drop style={{ animationDelay: '0.6s' }} />
            <Drop style={{ animationDelay: '1.2s' }} />
          </WaterDrops>
        </IconRing>

        <ModeLabel>{`PROGRAMA ${status.program ?? '?'}`}</ModeLabel>
        <ZoneTitle>Zona {status.zone ?? '?'}</ZoneTitle>

        <ProgressContainer>
          <ProgressBar>
            <ProgressFill style={{ width: `${progress}%` }} />
          </ProgressBar>
          <ProgressTimes>
            <span>{elapsed} min</span>
            <span>{rem} min</span>
          </ProgressTimes>
        </ProgressContainer>

        <Controls>
          <PauseBtn onClick={togglePause} $paused={isPaused}>
            {isPaused
              ? <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M5 3l14 9-14 9V3z"/></svg>
              : <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            }
          </PauseBtn>
          <StopBtn onClick={() => setConfirmStop(true)}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
            Detener
          </StopBtn>
        </Controls>

        {prog && (
          <ZoneChips>
            {prog.zones.map((z, i) => {
              if (z === 0) return null;
              const isActive = (i + 1) === status.zone;
              return (
                <ZoneChip key={i} $active={isActive} $color={ZONE_COLORS[i]}>
                  <ChipDot $color={ZONE_COLORS[i]} />
                  Zona {i + 1} <strong>{z} min</strong>
                </ZoneChip>
              );
            })}
          </ZoneChips>
        )}
      </Content>

      {confirmStop && (
        <ConfirmModal
          title="¿Detener riego?"
          body="Se interrumpirá el programa en curso."
          confirmLabel="Detener"
          onConfirm={() => { setConfirmStop(false); cancelProgram(); navigate('/'); }}
          onCancel={() => setConfirmStop(false)}
        />
      )}
    </Wrapper>
  );
}
