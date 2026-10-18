import { Model } from '@nozbe/watermelondb';

// Models sem decorators: leitura e escrita pelo raw (snake_case), que é o formato do sync.
// Escrita só dentro de db.write(), pelos repositórios.

export class ExerciseModel extends Model {
  static table = 'exercise';
}

export class RoutineModel extends Model {
  static table = 'routine';
}

export class RoutineExerciseModel extends Model {
  static table = 'routine_exercise';
}

export class RoutineSetModel extends Model {
  static table = 'routine_set';
}

/** Classes dos models para o `new Database`. */
export const modelClasses: (typeof Model)[] = [ExerciseModel, RoutineModel, RoutineExerciseModel, RoutineSetModel];
